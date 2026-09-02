/**
 * POST /api/register  { nickname }   → 익명 플레이어 생성 + 토큰 발급
 * GET  /api/register?nickname=...    → 닉네임 중복 확인 (사양 §34)
 *
 * 개인정보(사양 §43): 실명·학번·전화·이메일을 받지 않는다.
 * 서버는 개인정보와 무관한 익명 ID를 생성하고, 화면에는 닉네임만 표시한다.
 */

import {
  type Env,
  ok,
  fail,
  randomId,
  generateRecoveryCode,
  signToken,
  validateNickname,
} from '../_lib/util'

/** 닉네임 사용 가능 여부 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const check = validateNickname(url.searchParams.get('nickname'))
  if (!check.ok) return ok({ ok: true, available: false, message: check.message })

  const row = await env.DB.prepare(
    'SELECT 1 AS x FROM players WHERE nickname = ?1 COLLATE NOCASE LIMIT 1',
  )
    .bind(check.value)
    .first<{ x: number }>()

  return ok({
    ok: true,
    available: !row,
    message: row ? '이미 사용 중인 ID예요. 다른 고스트 헌터 ID를 만들어 주세요.' : null,
  })
}

/** 플레이어 생성 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { nickname?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', '요청을 이해하지 못했어요.')
  }

  const check = validateNickname(body.nickname)
  if (!check.ok) return fail('invalid_nickname', check.message)

  const now = Date.now()
  const id = randomId(16)
  const recovery = generateRecoveryCode()

  try {
    await env.DB.prepare(
      `INSERT INTO players (id, nickname, xp, coins, level, unique_ghosts, total_catches,
                            recovery_code, created_at, last_active_at)
       VALUES (?1, ?2, 0, 0, 1, 0, 0, ?3, ?4, ?4)`,
    )
      .bind(id, check.value, recovery, now)
      .run()
  } catch (e) {
    // UNIQUE 제약 위반 = 닉네임 중복 (동시 가입 경쟁 상황 포함)
    const msg = String(e)
    if (msg.includes('UNIQUE') && msg.includes('nickname')) {
      return fail(
        'nickname_taken',
        '이미 사용 중인 ID예요. 다른 고스트 헌터 ID를 만들어 주세요.',
      )
    }
    if (msg.includes('UNIQUE') && msg.includes('recovery_code')) {
      return fail('retry', '잠시 후 다시 시도해 주세요.')
    }
    return fail('server_error', '가입에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  const token = await signToken(env, id)

  return ok({
    ok: true,
    token,
    recoveryCode: recovery,
    player: {
      id,
      nickname: check.value,
      xp: 0,
      coins: 0,
      level: 1,
      uniqueGhosts: 0,
      totalCatches: 0,
    },
  })
}
