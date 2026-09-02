/**
 * POST /api/prize  { pin }
 *
 * 스태프가 학생의 폰에서 PIN 을 입력해 상품 수령을 확정한다.
 *
 * 이 방식을 쓰는 이유:
 *   화면만 보여주는 방식은 학생이 친구에게 보여주거나 다시 와서 또 받을 수 있다.
 *   서버에 수령 시각을 남기면 이후 아무리 새로고침해도 "수령 완료"로 고정된다.
 *
 * PIN 은 오조작 방지용이다. 학생이 PIN 을 알아내 스스로 확정해도
 * 자기 교환권만 소모될 뿐이라 운영상 손해가 없다.
 * 다만 무차별 입력은 막는다 (1분 5회).
 */

import { type Env, ok, fail, authenticate, loadEventConfig } from '../_lib/util'

interface PlayerRow {
  id: string
  nickname: string
  unique_ghosts: number
  prize_unlocked_at: number | null
  prize_claimed_at: number | null
  prize_code: string | null
  is_blocked: number
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const playerId = await authenticate(request, env)
  if (!playerId) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)

  let body: { pin?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', '요청을 이해하지 못했어요.')
  }
  const pin = String(body.pin ?? '').trim()

  const db = env.DB
  const now = Date.now()
  const cfg = await loadEventConfig(db)

  const log = async (result: string, code: string | null) => {
    await db
      .prepare(
        'INSERT INTO prize_logs (player_id, prize_code, result, created_at) VALUES (?1, ?2, ?3, ?4)',
      )
      .bind(playerId, code, result, now)
      .run()
  }

  if (!cfg.prize_enabled) {
    await log('disabled', null)
    return fail('disabled', '지금은 상품 지급 기간이 아니에요.')
  }

  const player = await db
    .prepare('SELECT * FROM players WHERE id = ?1')
    .bind(playerId)
    .first<PlayerRow>()
  if (!player) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)
  if (player.is_blocked) return fail('blocked', '참여가 제한된 계정이에요.')

  // 무차별 PIN 입력 방지
  const recent = await db
    .prepare(
      "SELECT COUNT(*) AS c FROM prize_logs WHERE player_id = ?1 AND result = 'bad_pin' AND created_at > ?2",
    )
    .bind(playerId, now - 60_000)
    .first<{ c: number }>()
  if ((recent?.c ?? 0) >= 5) {
    return fail('rate_limited', '잠시 후 다시 시도해 주세요.', { retryAfterSec: 60 })
  }

  if (!player.prize_unlocked_at) {
    await log('not_unlocked', null)
    return fail('not_unlocked', `유령 ${cfg.prize_threshold}마리를 모아야 받을 수 있어요.`, {
      remaining: Math.max(0, cfg.prize_threshold - player.unique_ghosts),
    })
  }

  if (player.prize_claimed_at) {
    await log('already', player.prize_code)
    return fail('already', '이미 수령한 교환권이에요.', { claimedAt: player.prize_claimed_at })
  }

  if (pin !== cfg.staff_pin) {
    await log('bad_pin', player.prize_code)
    return fail('bad_pin', 'PIN이 올바르지 않아요. 스태프에게 확인해 주세요.')
  }

  await db
    .prepare('UPDATE players SET prize_claimed_at = ?2 WHERE id = ?1 AND prize_claimed_at IS NULL')
    .bind(playerId, now)
    .run()
  await log('ok', player.prize_code)

  return ok({
    ok: true,
    claimedAt: now,
    code: player.prize_code,
    nickname: player.nickname,
    name: cfg.prize_name,
    message: `${cfg.prize_name} 수령 완료!`,
  })
}
