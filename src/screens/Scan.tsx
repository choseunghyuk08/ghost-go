import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Card, Screen } from '../components/ui'
import {
  checkCameraPreconditions,
  detectInAppBrowser,
  getDecoder,
  openCamera,
  parseSlug,
  type CameraHandle,
} from '../lib/qr'

/**
 * QR 스캔 화면.
 *
 * 현장에서 실제로 터지는 것들을 전부 화면에 반영한다:
 *  - 카카오톡·인스타 인앱 브라우저는 카메라가 막힌다 → 감지해서 외부 브라우저 유도
 *  - 권한 거부/영구차단 → 복구 방법 안내
 *  - 어두운 복도 → 플래시 버튼 (지원 기기만)
 *  - HTTPS 아님 → 명확한 안내
 */

type Phase = 'checking' | 'inapp' | 'blocked' | 'requesting' | 'scanning' | 'denied'

export function Scan() {
  const nav = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const camRef = useRef<CameraHandle | null>(null)
  const loopRef = useRef<number | undefined>(undefined)
  const doneRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('checking')
  const [reason, setReason] = useState<string>('')
  const [torchOn, setTorchOn] = useState(false)
  const [canTorch, setCanTorch] = useState(false)
  const [engine, setEngine] = useState<'native' | 'wasm' | null>(null)
  const [hint, setHint] = useState('유령의 흔적을 찾아보세요…')

  const stop = useCallback(() => {
    window.clearTimeout(loopRef.current)
    camRef.current?.stop()
    camRef.current = null
  }, [])

  /** QR 을 찾으면 즉시 발견 연출로 넘어간다 (서버 호출은 암전 뒤에서 처리) */
  const onFound = useCallback(
    (slug: string) => {
      if (doneRef.current) return
      doneRef.current = true
      if ('vibrate' in navigator) navigator.vibrate?.([18, 40, 90])
      stop()
      nav('/reveal', { state: { slug } })
    },
    [nav, stop],
  )

  const start = useCallback(async () => {
    const pre = checkCameraPreconditions()
    if (!pre.ok) {
      setReason(pre.reason!)
      setPhase('blocked')
      return
    }

    setPhase('requesting')
    try {
      const cam = await openCamera()
      camRef.current = cam
      setCanTorch(cam.canTorch)

      const video = videoRef.current
      if (!video) return
      video.srcObject = cam.stream
      video.setAttribute('playsinline', 'true') // iOS 전체화면 전환 방지
      await video.play()

      const { decode, engine: eng } = await getDecoder()
      setEngine(eng)
      setPhase('scanning')

      // 10fps 정도로 충분하다. 매 프레임 디코딩하면 저사양 기기가 발열·프레임드랍한다.
      const tick = async () => {
        if (doneRef.current || !videoRef.current) return
        try {
          const raw = await decode(videoRef.current)
          if (raw) {
            const slug = parseSlug(raw)
            if (slug) {
              onFound(slug)
              return
            }
            setHint('고스트 GO의 유령 QR이 아니에요.')
          }
        } catch {
          /* 디코딩 실패는 정상 — 다음 프레임에서 다시 시도 */
        }
        loopRef.current = window.setTimeout(tick, 100)
      }
      void tick()
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') setPhase('denied')
      else {
        setReason('카메라를 열 수 없었어요. 다른 앱이 카메라를 쓰고 있는지 확인해 주세요.')
        setPhase('blocked')
      }
    }
  }, [onFound])

  useEffect(() => {
    const inApp = detectInAppBrowser()
    if (inApp.isInApp) {
      setReason(inApp.name ?? '인앱 브라우저')
      setPhase('inapp')
      return
    }
    void start()
    return () => {
      doneRef.current = true
      stop()
    }
  }, [start, stop])

  async function toggleTorch() {
    const next = !torchOn
    await camRef.current?.setTorch(next)
    setTorchOn(next)
  }

  /* ---------------------------------------------------------------- 안내 화면 */

  if (phase === 'inapp') {
    return (
      <Screen className="justify-center px-6">
        <Card className="p-6 text-center">
          <div className="text-5xl">🚫📷</div>
          <h2 className="mt-3 text-lg font-black text-ghost-white">
            {reason}에서는 카메라를 쓸 수 없어요
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-lilac">
            오른쪽 위 <b>⋯</b> 메뉴를 눌러
            <br />
            <b className="text-pumpkin">“다른 브라우저로 열기”</b> 또는
            <br />
            <b className="text-pumpkin">“Safari/Chrome으로 열기”</b>를 선택해 주세요.
          </p>
          <div className="mt-4 rounded-xl bg-void/60 p-3 text-[11px] break-all text-muted">
            {window.location.origin}
          </div>
          <Btn
            variant="secondary"
            full
            className="mt-4"
            onClick={() => navigator.clipboard?.writeText(window.location.origin)}
          >
            주소 복사하기
          </Btn>
          <Btn variant="ghost" full className="mt-2" onClick={() => nav('/')}>
            홈으로
          </Btn>
        </Card>
      </Screen>
    )
  }

  if (phase === 'denied' || phase === 'blocked') {
    return (
      <Screen className="justify-center px-6">
        <Card className="p-6 text-center">
          <div className="text-5xl">📷</div>
          <h2 className="mt-3 text-lg font-black text-ghost-white">
            {phase === 'denied' ? '카메라 권한이 필요해요' : '카메라를 열 수 없어요'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-lilac">
            {phase === 'denied' ? (
              <>
                주소창 왼쪽의 자물쇠(또는 ⓘ)를 눌러
                <br />
                <b className="text-pumpkin">카메라 → 허용</b>으로 바꾼 뒤
                <br />
                페이지를 새로고침해 주세요.
              </>
            ) : (
              reason
            )}
          </p>
          <Btn full className="mt-4" onClick={() => window.location.reload()}>
            다시 시도
          </Btn>
          <Btn variant="ghost" full className="mt-2" onClick={() => nav('/')}>
            홈으로
          </Btn>
        </Card>
      </Screen>
    )
  }

  /* ---------------------------------------------------------------- 카메라 */

  return (
    <div className="relative min-h-[100dvh] bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* 어둡게 깔고 가운데만 뚫는다 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-void/55" />
        <div
          className="absolute top-1/2 left-1/2 h-[68vw] max-h-[300px] w-[68vw] max-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[28px]"
          style={{ boxShadow: '0 0 0 100vmax rgba(11,6,20,0.62)' }}
        />
        {/* 모서리 가이드 */}
        <div className="absolute top-1/2 left-1/2 h-[68vw] max-h-[300px] w-[68vw] max-w-[300px] -translate-x-1/2 -translate-y-1/2">
          {[
            'top-0 left-0 border-t-4 border-l-4 rounded-tl-[24px]',
            'top-0 right-0 border-t-4 border-r-4 rounded-tr-[24px]',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[24px]',
            'bottom-0 right-0 border-b-4 border-r-4 rounded-br-[24px]',
          ].map((c) => (
            <span key={c} className={`absolute h-10 w-10 border-pumpkin ${c}`} />
          ))}
          {/* 스캔 라인 */}
          <div className="absolute inset-x-4 top-1/2 h-0.5 rounded-full bg-pumpkin/70 shadow-[0_0_12px_2px_#ff7a00] anim-sweep" />
        </div>
      </div>

      {/* 상단 */}
      <div className="safe-t absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 pt-3">
        <button
          onClick={() => nav('/')}
          className="tap glass flex h-11 w-11 items-center justify-center rounded-full text-lg"
          aria-label="닫기"
        >
          ✕
        </button>
        <p className="mt-2 flex-1 text-center text-sm font-bold text-ghost-white drop-shadow">
          {phase === 'requesting' ? '카메라를 준비하고 있어요…' : hint}
        </p>
        {canTorch ? (
          <button
            onClick={toggleTorch}
            className={`tap flex h-11 w-11 items-center justify-center rounded-full text-lg ${
              torchOn ? 'bg-pumpkin text-void' : 'glass'
            }`}
            aria-label="플래시"
          >
            🔦
          </button>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>

      {/* 하단 */}
      <div className="safe-b absolute inset-x-0 bottom-0 z-10 px-6 pb-6 text-center">
        <p className="text-sm text-lilac drop-shadow">유령 QR을 사각형 안에 맞춰 주세요.</p>
        {engine === 'wasm' && (
          <p className="mt-1 text-[11px] text-muted">인식이 느리면 QR에 조금 더 가까이 가 보세요.</p>
        )}
        <p className="mt-3 text-[11px] text-pumpkin-soft">⚠️ 걸어 다니면서 스캔하지 마세요</p>
      </div>
    </div>
  )
}
