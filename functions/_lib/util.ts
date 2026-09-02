/**
 * Cloudflare Pages Functions 공용 유틸
 *
 * 설계 원칙: 게임 판정은 전부 여기(서버)에서 한다.
 * 클라이언트는 결과만 받는다. XP·코인·레벨을 클라이언트가 계산하지 않는다.
 */

import { CROCKFORD } from '../../src/lib/slug'

export interface Env {
  DB: D1Database
  /** 플레이어 토큰 서명 키. `npx wrangler pages secret put TOKEN_SECRET` 로 등록 */
  TOKEN_SECRET?: string
  /** 관리자 페이지 접근 키 (PHASE 3) */
  ADMIN_KEY?: string
}

/* ---------------------------------------------------------------- 응답 --- */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

export function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

/**
 * 실패도 HTTP 200 + { ok:false } 로 내려준다 (PART 0 모순 11).
 * 이유: 실패 원장이 남아야 "스캔 0회 코드 = 인식 불가 의심" 같은 현장 진단이 가능하다.
 * 인증 실패만 401로 구분한다 (클라이언트가 재등록을 유도해야 하므로).
 */
export function fail(
  reason: string,
  message: string,
  extra: Record<string, unknown> = {},
  status = 200,
): Response {
  return new Response(JSON.stringify({ ok: false, reason, message, ...extra }), {
    status,
    headers: JSON_HEADERS,
  })
}

/* ------------------------------------------------------------------ ID --- */

export function randomId(len = 16): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < len; i++) s += CROCKFORD[bytes[i] % 32]
  return s
}

/** 교환권 번호 — 스태프가 눈으로 대조하기 쉽게 4자리 */
export function generatePrizeCode(): string {
  const b = new Uint8Array(4)
  crypto.getRandomValues(b)
  let s = ''
  for (let i = 0; i < 4; i++) s += CROCKFORD[b[i] % 32]
  return s
}

export function generateRecoveryCode(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  let s = ''
  for (let i = 0; i < 8; i++) s += CROCKFORD[b[i] % 32]
  return `GG-${s.slice(0, 4)}-${s.slice(4)}`
}

/* --------------------------------------------------------------- 토큰 --- */
/**
 * 익명 플레이어 인증.
 * Firebase Auth / Supabase Auth 같은 기성 익명 로그인이 없으므로 직접 구현한다.
 *
 * 토큰 = base64url(payload) + "." + base64url(HMAC-SHA256(payload, secret))
 * 위조가 불가능하므로 클라이언트가 player_id 를 바꿔치기할 수 없다.
 */

const enc = new TextEncoder()

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

/** 개발 환경에서 시크릿을 등록하지 않았을 때의 폴백 (운영에서는 반드시 설정) */
function resolveSecret(env: Env): string {
  return env.TOKEN_SECRET || 'ghostgo-dev-secret-DO-NOT-USE-IN-PRODUCTION'
}

export async function signToken(env: Env, playerId: string): Promise<string> {
  const payload = JSON.stringify({ pid: playerId, iat: Date.now() })
  const payloadBytes = enc.encode(payload)
  const key = await hmacKey(resolveSecret(env))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, payloadBytes))
  return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`
}

export async function verifyToken(env: Env, token: string): Promise<string | null> {
  const dot = token.indexOf('.')
  if (dot < 1) return null
  try {
    const payloadBytes = b64urlDecode(token.slice(0, dot))
    const sig = b64urlDecode(token.slice(dot + 1))
    const key = await hmacKey(resolveSecret(env))
    const valid = await crypto.subtle.verify('HMAC', key, sig, payloadBytes)
    if (!valid) return null
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as { pid?: string }
    return typeof parsed.pid === 'string' ? parsed.pid : null
  } catch {
    return null
  }
}

/** Authorization: Bearer <token> 에서 playerId 추출 */
export async function authenticate(request: Request, env: Env): Promise<string | null> {
  const header = request.headers.get('authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  return verifyToken(env, m[1].trim())
}

/* ------------------------------------------------------------- 닉네임 --- */

/** 최소한의 금칙어 필터 — 학교 행사용. 완벽할 필요는 없고 명백한 것만 거른다. */
const BANNED = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅄ', '좆', '섹스', 'fuck', 'shit', '개새', '지랄']

export function validateNickname(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') return { ok: false, message: '닉네임을 입력해 주세요.' }
  const value = raw.trim().replace(/\s+/g, ' ')
  // 사양 §34: 2~12자, 한글·영문·숫자. 특수문자는 _ - 만 허용(최소화)
  if (value.length < 2) return { ok: false, message: '고스트 헌터 ID는 2글자 이상이어야 해요.' }
  if (value.length > 12) return { ok: false, message: '고스트 헌터 ID는 12글자까지 쓸 수 있어요.' }
  if (!/^[가-힣a-zA-Z0-9_-]+$/.test(value.replace(/ /g, ''))) {
    return { ok: false, message: '한글·영문·숫자만 쓸 수 있어요.' }
  }
  const lower = value.toLowerCase().replace(/\s/g, '')
  if (BANNED.some((w) => lower.includes(w))) {
    return { ok: false, message: '사용할 수 없는 닉네임이에요.' }
  }
  return { ok: true, value }
}

/* ------------------------------------------------------------ 이벤트 --- */

export interface EventRow {
  status: 'before' | 'running' | 'ended'
  starts_at: number | null
  ends_at: number | null
  duplicate_xp: number
  duplicate_coin: number
  duplicate_reward_enabled: number
  same_ghost_cooldown_sec: number
  scan_cooldown_sec: number
  max_scans_per_min: number
  same_ghost_daily_limit: number
  ranking_frozen: number
  frozen_at: number | null
  // 상품 지급
  prize_enabled: number
  prize_threshold: number
  prize_name: string
  staff_pin: string
}

const DEFAULT_EVENT: EventRow = {
  status: 'running',
  starts_at: null,
  ends_at: null,
  duplicate_xp: 10,
  duplicate_coin: 2,
  duplicate_reward_enabled: 1,
  same_ghost_cooldown_sec: 60,
  scan_cooldown_sec: 3,
  max_scans_per_min: 12,
  same_ghost_daily_limit: 0,
  ranking_frozen: 0,
  frozen_at: null,
  prize_enabled: 1,
  prize_threshold: 4,
  prize_name: '음료수',
  staff_pin: '0000',
}

export async function loadEventConfig(db: D1Database): Promise<EventRow> {
  const row = await db.prepare('SELECT * FROM event_config WHERE id = 1').first<EventRow>()
  return row ?? DEFAULT_EVENT
}

/** 지금 스캔을 받아도 되는 상태인지 */
export function eventGate(cfg: EventRow, now: number): { open: boolean; reason?: string; message?: string } {
  if (cfg.status === 'before') {
    return { open: false, reason: 'event_not_started', message: '아직 이벤트가 시작되지 않았어요.' }
  }
  if (cfg.status === 'ended') {
    return { open: false, reason: 'event_ended', message: '이벤트가 종료되었어요. 참여해 줘서 고마워요!' }
  }
  if (cfg.starts_at && now < cfg.starts_at) {
    return { open: false, reason: 'event_not_started', message: '아직 이벤트가 시작되지 않았어요.' }
  }
  if (cfg.ends_at && now > cfg.ends_at) {
    return { open: false, reason: 'event_ended', message: '이벤트가 종료되었어요. 참여해 줘서 고마워요!' }
  }
  return { open: true }
}

/** 하루 경계 (KST 기준) — "같은 유령 하루 1회 보상" 판정에 사용 */
export function kstDayStart(ts: number): number {
  const KST = 9 * 60 * 60 * 1000
  return Math.floor((ts + KST) / 86_400_000) * 86_400_000 - KST
}
