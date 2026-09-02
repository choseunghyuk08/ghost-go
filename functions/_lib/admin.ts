/**
 * 관리자 인증
 *
 * 경로(/ops)를 숨기는 것은 보안이 아니다. 실제 방어는 전부 여기 서버에 있다.
 *  - 비밀번호는 Cloudflare 시크릿(ADMIN_KEY)에만 존재. 저장소·번들에 없다.
 *  - 로그인 성공 시 HttpOnly 서명 쿠키 발급 → JS 로 훔칠 수 없다.
 *  - 모든 관리자 API 가 쿠키를 검증한다. 화면만 열면 빈 껍데기다.
 *  - 비밀번호 시도는 서버에서 기록·제한한다.
 */

import { type Env, ok, fail } from './util'

const COOKIE = 'ggops'
const TTL_MS = 8 * 60 * 60 * 1000 // 행사 하루치
const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64url(s: string): Uint8Array {
  const p = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function secret(env: Env): string {
  // 운영에서는 반드시 ADMIN_KEY 를 등록할 것. 미설정 시 로그인 자체를 막는다.
  return env.ADMIN_KEY ?? ''
}

async function key(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode('ops:' + secret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** 타이밍 공격을 피해 비밀번호를 비교한다 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function issueSession(env: Env): Promise<string> {
  const payload = enc.encode(JSON.stringify({ exp: Date.now() + TTL_MS }))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(env), payload))
  return `${b64url(payload)}.${b64url(sig)}`
}

export async function verifySession(env: Env, token: string): Promise<boolean> {
  const dot = token.indexOf('.')
  if (dot < 1) return false
  try {
    const payload = unb64url(token.slice(0, dot))
    const sig = unb64url(token.slice(dot + 1))
    if (!(await crypto.subtle.verify('HMAC', await key(env), sig, payload))) return false
    const { exp } = JSON.parse(new TextDecoder().decode(payload)) as { exp: number }
    return typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}

export function sessionCookie(token: string, maxAgeSec = TTL_MS / 1000): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function readCookie(request: Request): string | null {
  const raw = request.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return null
}

/** 관리자 API 가드. 통과하지 못하면 Response 를 돌려준다. */
export async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  if (!secret(env)) {
    return fail('not_configured', '관리자 비밀번호가 설정되지 않았습니다.', {}, 503)
  }
  const token = readCookie(request)
  if (!token || !(await verifySession(env, token))) {
    return fail('unauthorized', '로그인이 필요합니다.', {}, 401)
  }
  return null
}

/** 비밀번호 확인 + 시도 제한 (5회/10분) */
export async function attemptLogin(
  request: Request,
  env: Env,
  password: string,
): Promise<Response> {
  if (!secret(env)) {
    return fail('not_configured', '관리자 비밀번호가 설정되지 않았습니다.', {}, 503)
  }

  const db = env.DB
  const now = Date.now()
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'

  const recent = await db
    .prepare(
      "SELECT COUNT(*) c FROM prize_logs WHERE result = 'admin_bad' AND player_id = ?1 AND created_at > ?2",
    )
    .bind(ip, now - 10 * 60_000)
    .first<{ c: number }>()

  if ((recent?.c ?? 0) >= 5) {
    return fail('locked', '시도 횟수를 초과했습니다. 10분 후 다시 시도하세요.', {}, 429)
  }

  if (!safeEqual(password, secret(env))) {
    await db
      .prepare(
        "INSERT INTO prize_logs (player_id, prize_code, result, created_at) VALUES (?1, NULL, 'admin_bad', ?2)",
      )
      .bind(ip, now)
      .run()
    return fail('bad_password', '비밀번호가 올바르지 않습니다.')
  }

  const token = await issueSession(env)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': sessionCookie(token),
    },
  })
}

export { ok, fail }
