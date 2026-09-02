/**
 * QR 디코딩 계층
 *
 * 1순위: 브라우저 네이티브 BarcodeDetector (Android Chrome 등) — 추가 다운로드 0
 * 2순위: zxing-wasm 지연 로드 (iOS Safari는 BarcodeDetector 미지원)
 *
 * 확정 문서 v2 §8: WASM은 필요한 기기에서만 받도록 반드시 동적 import 한다.
 */

export type Decoder = (source: HTMLVideoElement) => Promise<string | null>

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats?: string[] }): BarcodeDetectorLike
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

export async function hasNativeDetector(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.BarcodeDetector) return false
  try {
    const formats = (await window.BarcodeDetector.getSupportedFormats?.()) ?? []
    // getSupportedFormats가 없으면 일단 있다고 보고 시도한다
    return formats.length === 0 || formats.includes('qr_code')
  } catch {
    return false
  }
}

/** 네이티브 디코더 */
async function createNativeDecoder(): Promise<Decoder> {
  const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
  return async (video) => {
    if (video.readyState < 2) return null
    try {
      const results = await detector.detect(video)
      return results.length > 0 ? results[0].rawValue : null
    } catch {
      return null
    }
  }
}

/** zxing-wasm 폴백 디코더 (지연 로드) */
async function createWasmDecoder(): Promise<Decoder> {
  const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader')

  // WASM 바이너리는 CDN이 아니라 번들에서 가져온다 (학교망 CDN 차단 대비)
  await prepareZXingModule({ fireImmediately: true })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  return async (video) => {
    if (video.readyState < 2) return null
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return null

    // 성능: 긴 변 640px로 다운스케일 후 중앙 정사각형만 디코딩
    const side = Math.min(vw, vh)
    const target = Math.min(640, side)
    canvas.width = target
    canvas.height = target
    ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, target, target)

    try {
      const imageData = ctx.getImageData(0, 0, target, target)
      const results = await readBarcodes(imageData, {
        tryHarder: true,
        formats: ['QRCode'],
        maxNumberOfSymbols: 1,
      })
      return results.length > 0 ? results[0].text : null
    } catch {
      return null
    }
  }
}

let decoderPromise: Promise<{ decode: Decoder; engine: 'native' | 'wasm' }> | null = null

/** 디코더를 1회만 생성해 재사용한다 */
export function getDecoder() {
  if (!decoderPromise) {
    decoderPromise = (async () => {
      if (await hasNativeDetector()) {
        return { decode: await createNativeDecoder(), engine: 'native' as const }
      }
      return { decode: await createWasmDecoder(), engine: 'wasm' as const }
    })()
  }
  return decoderPromise
}

/* ==========================================================================
   QR 페이로드 파싱
   확정 문서 v2 §4-4:
     HTTPS://<도메인>/S/GG1-XXXXXXXXXX   (전부 대문자, 영숫자 모드 유지)
   슬러그: Crockford Base32 10자 (혼동 문자 I·L·O·U 제외)
   ========================================================================== */

const SLUG_RE = /GG1-[0-9A-HJKMNP-TV-Z]{10}/i

/**
 * QR 문자열에서 슬러그를 추출한다.
 * URL 형태·순수 슬러그 형태 모두 허용하고, 그 외에는 null.
 */
export function parseSlug(raw: string): string | null {
  if (!raw) return null
  const m = raw.toUpperCase().match(SLUG_RE)
  return m ? m[0] : null
}

/** 슬러그로 QR에 넣을 전체 URL을 만든다 (관리자 QR 생성용) */
export function slugToUrl(slug: string, origin = window.location.origin): string {
  return `${origin}/S/${slug}`.toUpperCase()
}

/* ==========================================================================
   카메라 제어
   ========================================================================== */

export interface CameraHandle {
  stream: MediaStream
  stop: () => void
  /** 플래시(토치) 지원 여부 — 어두운 복도 대응 */
  canTorch: boolean
  setTorch: (on: boolean) => Promise<void>
}

export async function openCamera(): Promise<CameraHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' }, // 후면 카메라
      width: { ideal: 1280 },
      height: { ideal: 1280 },
    },
    audio: false,
  })

  const track = stream.getVideoTracks()[0]
  const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
  const canTorch = Boolean(caps.torch)

  return {
    stream,
    canTorch,
    stop: () => stream.getTracks().forEach((t) => t.stop()),
    setTorch: async (on: boolean) => {
      if (!canTorch) return
      try {
        // torch 는 표준 타입에 없지만 다수 안드로이드 기기가 지원한다 (어두운 복도 대응)
        await track.applyConstraints({ advanced: [{ torch: on }] } as unknown as MediaTrackConstraints)
      } catch {
        /* 미지원 기기는 무시 */
      }
    },
  }
}

/**
 * 인앱 브라우저 감지 (카카오톡·인스타그램 등)
 * 리스크 문서에서 "학교 행사에서 거의 확실히 터진다"고 지목된 항목.
 * 인앱 브라우저는 getUserMedia가 막혀 있는 경우가 많아 외부 브라우저 유도가 필요하다.
 */
export function detectInAppBrowser(): { isInApp: boolean; name: string | null } {
  const ua = navigator.userAgent
  const table: Array<[RegExp, string]> = [
    [/KAKAOTALK/i, '카카오톡'],
    [/Instagram/i, '인스타그램'],
    [/FBAN|FBAV/i, '페이스북'],
    [/Line\//i, '라인'],
    [/NAVER\(inapp/i, '네이버 앱'],
    [/DaumApps/i, '다음 앱'],
    [/everytimeApp/i, '에브리타임'],
  ]
  for (const [re, name] of table) {
    if (re.test(ua)) return { isInApp: true, name }
  }
  return { isInApp: false, name: null }
}

/** 카메라 사용 가능 여부 사전 점검 */
export function checkCameraPreconditions(): { ok: boolean; reason?: string } {
  if (!window.isSecureContext) {
    return { ok: false, reason: 'HTTPS 연결에서만 카메라를 쓸 수 있어요.' }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: '이 브라우저에서는 카메라를 쓸 수 없어요.' }
  }
  return { ok: true }
}
