/**
 * POST   /api/admin/login   { password }  → 세션 쿠키 발급
 * GET    /api/admin/login                 → 로그인 상태 확인
 * DELETE /api/admin/login                 → 로그아웃
 */

import type { Env } from '../../_lib/util'
import { attemptLogin, clearCookie, requireAdmin, ok, fail } from '../../_lib/admin'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', '요청을 이해하지 못했습니다.')
  }
  const password = String(body.password ?? '')
  if (!password) return fail('bad_password', '비밀번호를 입력하세요.')
  return attemptLogin(request, env, password)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  return ok({ ok: true, authenticated: true })
}

export const onRequestDelete: PagesFunction<Env> = async () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': clearCookie(),
    },
  })
