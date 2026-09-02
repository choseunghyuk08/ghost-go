/**
 * POST /api/admin/config  { action, ... }
 *
 * 행사 중 코드 수정·재배포 없이 바꿔야 하는 것들.
 * 음료 재고가 떨어지면 기준을 올리고, 사고가 나면 특정 QR 을 끈다.
 */

import type { Env } from '../../_lib/util'
import { requireAdmin, ok, fail } from '../../_lib/admin'

type Body = {
  action?: string
  status?: string
  prizeEnabled?: boolean
  prizeThreshold?: number
  prizeName?: string
  staffPin?: string
  scanCooldownSec?: number
  sameGhostCooldownSec?: number
  maxScansPerMin?: number
  duplicateXp?: number
  duplicateCoin?: number
  slug?: string
  active?: boolean
  playerId?: string
  blocked?: boolean
}

const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  return i < lo || i > hi ? null : i
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await requireAdmin(request, env)
  if (denied) return denied

  let body: Body
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', '요청을 이해하지 못했습니다.')
  }

  const db = env.DB
  const sets: string[] = []
  const args: unknown[] = []
  const push = (col: string, val: unknown) => {
    args.push(val)
    sets.push(`${col} = ?${args.length}`)
  }

  switch (body.action) {
    /* --- 이벤트 상태 --------------------------------------------------- */
    case 'event': {
      if (!['before', 'running', 'ended'].includes(String(body.status))) {
        return fail('bad_request', '상태 값이 올바르지 않습니다.')
      }
      push('status', body.status)
      break
    }

    /* --- 상품 설정 ----------------------------------------------------- */
    case 'prize': {
      if (body.prizeEnabled !== undefined) push('prize_enabled', body.prizeEnabled ? 1 : 0)
      if (body.prizeThreshold !== undefined) {
        const n = int(body.prizeThreshold, 1, 20)
        if (n === null) return fail('bad_request', '기준은 1~20 사이여야 합니다.')
        push('prize_threshold', n)
      }
      if (body.prizeName !== undefined) {
        const s = String(body.prizeName).trim().slice(0, 20)
        if (!s) return fail('bad_request', '상품명을 입력하세요.')
        push('prize_name', s)
      }
      if (body.staffPin !== undefined) {
        const s = String(body.staffPin).trim()
        if (!/^\d{4,6}$/.test(s)) return fail('bad_request', 'PIN 은 숫자 4~6자리여야 합니다.')
        push('staff_pin', s)
      }
      break
    }

    /* --- 스캔 규칙 ----------------------------------------------------- */
    case 'rules': {
      const map: Array<[keyof Body, string, number, number]> = [
        ['scanCooldownSec', 'scan_cooldown_sec', 0, 120],
        ['sameGhostCooldownSec', 'same_ghost_cooldown_sec', 0, 86400],
        ['maxScansPerMin', 'max_scans_per_min', 1, 120],
        ['duplicateXp', 'duplicate_xp', 0, 1000],
        ['duplicateCoin', 'duplicate_coin', 0, 1000],
      ]
      for (const [k, col, lo, hi] of map) {
        if (body[k] !== undefined) {
          const n = int(body[k], lo, hi)
          if (n === null) return fail('bad_request', `${k} 값이 범위를 벗어났습니다.`)
          push(col, n)
        }
      }
      break
    }

    /* --- QR 개별 on/off (안전사고·훼손 대응) --------------------------- */
    case 'code': {
      const slug = String(body.slug ?? '')
      if (!/^GG1-[0-9A-HJKMNP-TV-Z]{10}$/.test(slug)) {
        return fail('bad_request', '코드 형식이 올바르지 않습니다.')
      }
      await db
        .prepare('UPDATE codes SET is_active = ?2 WHERE slug = ?1')
        .bind(slug, body.active ? 1 : 0)
        .run()
      return ok({ ok: true, slug, active: Boolean(body.active) })
    }

    /* --- 참가자 차단 --------------------------------------------------- */
    case 'player': {
      const id = String(body.playerId ?? '')
      if (!id) return fail('bad_request', '참가자를 지정하세요.')
      await db
        .prepare('UPDATE players SET is_blocked = ?2 WHERE id = ?1')
        .bind(id, body.blocked ? 1 : 0)
        .run()
      return ok({ ok: true, playerId: id, blocked: Boolean(body.blocked) })
    }

    default:
      return fail('bad_request', '알 수 없는 요청입니다.')
  }

  if (!sets.length) return fail('bad_request', '변경할 항목이 없습니다.')

  await db
    .prepare(`UPDATE event_config SET ${sets.join(', ')} WHERE id = 1`)
    .bind(...args)
    .run()

  const row = await db.prepare('SELECT * FROM event_config WHERE id = 1').first()
  return ok({ ok: true, config: row })
}
