/**
 * QR 슬러그 생성 · 검증
 *
 * 확정 문서 v2 §4-3 / PART 0 모순 1:
 * 순차 ID(GHOST_001, G01)는 20번 시도로 도감이 완주되는 치명적 취약점이 있다.
 * 추측 불가능한 랜덤 슬러그를 쓰고, Firestore 문서 ID로 사용해 `list`를 막는다.
 *
 * 문자셋: Crockford Base32 (혼동 문자 I·L·O·U 제외) — 인쇄물을 사람이 읽을 때 오독 방지
 * 길이 10자 → 탐색 공간 32^10 ≈ 1.1 × 10^15
 */

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // 32자, I·L·O·U 제외

export const SLUG_PREFIX = 'GG1-'
export const SLUG_BODY_LEN = 10

/** 암호학적 난수로 슬러그 생성 (운영용 — 관리자 QR 발급) */
export function generateSlug(): string {
  const bytes = new Uint8Array(SLUG_BODY_LEN)
  crypto.getRandomValues(bytes)
  let body = ''
  for (let i = 0; i < SLUG_BODY_LEN; i++) {
    body += CROCKFORD[bytes[i] % 32]
  }
  return SLUG_PREFIX + body
}

/**
 * 결정적 슬러그 생성 (개발·목 모드 전용)
 *
 * ⚠️ 운영에서는 절대 사용하지 말 것 — 시드가 알려지면 전부 추측 가능해진다.
 * 개발 중에는 코드를 다시 시드해도 인쇄해 둔 테스트 QR이 계속 동작해야 하므로 필요하다.
 */
export function devSlug(ghostId: string, copyNo: number): string {
  // FNV-1a 32bit 를 두 번 돌려 50비트가량을 확보한다
  const seed = `${ghostId}#${copyNo}#ghostgo-dev`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < seed.length; i++) {
    h1 ^= seed.charCodeAt(i)
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 ^= seed.charCodeAt(seed.length - 1 - i)
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0
  }
  let body = ''
  let a = h1
  let b = h2
  for (let i = 0; i < SLUG_BODY_LEN; i++) {
    const v = i % 2 === 0 ? a : b
    body += CROCKFORD[v % 32]
    if (i % 2 === 0) a = Math.floor(a / 32) || Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) >>> 0
    else b = Math.floor(b / 32) || Math.imul(b ^ 0x7f4a7c15, 0x01000193) >>> 0
  }
  return SLUG_PREFIX + body
}

/** 사람이 읽기 쉽게 4자리씩 끊어 표시 (인쇄물 하단 대체 코드) */
export function formatSlug(slug: string): string {
  const body = slug.replace(SLUG_PREFIX, '')
  return `${SLUG_PREFIX}${body.slice(0, 5)}-${body.slice(5)}`
}

/** 복구 코드 (계정 유실 대비) — GG-XXXX-XXXX */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < 8; i++) s += CROCKFORD[bytes[i] % 32]
  return `GG-${s.slice(0, 4)}-${s.slice(4)}`
}
