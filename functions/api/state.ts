/**
 * GET /api/state → 앱이 필요한 상태를 한 번에 (모바일 왕복 최소화)
 *   플레이어 / 도감(20종, 미발견은 실루엣만) / 이벤트 상태
 *
 * 미발견 유령의 이름·설명은 절대 내려보내지 않는다.
 * (개발자도구로 응답을 열어 도감을 미리 보는 것을 차단)
 */

import { type Env, ok, fail, authenticate, loadEventConfig, eventGate } from '../_lib/util'
import { levelProgress, titleFromLevel } from '../../src/data/ghosts'

interface PlayerRow {
  id: string
  nickname: string
  xp: number
  coins: number
  level: number
  unique_ghosts: number
  total_catches: number
  created_at: number
  is_blocked: number
  prize_unlocked_at: number | null
  prize_claimed_at: number | null
  prize_code: string | null
}

interface DexRow {
  ghost_id: string
  no: number
  name: string
  description: string
  rarity: string
  attribute: string
  shape: string
  floor: number
  first_discovered_at: number | null
  last_scanned_at: number | null
  scan_count: number | null
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const playerId = await authenticate(request, env)
  if (!playerId) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)

  const db = env.DB

  const player = await db
    .prepare('SELECT * FROM players WHERE id = ?1')
    .bind(playerId)
    .first<PlayerRow>()
  if (!player) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)

  const cfg = await loadEventConfig(db)
  const gate = eventGate(cfg, Date.now())

  const { results } = await db
    .prepare(
      `SELECT g.ghost_id, g.no, g.name, g.description, g.rarity, g.attribute, g.shape, g.floor,
              d.first_discovered_at, d.last_scanned_at, d.scan_count
       FROM ghosts g
       LEFT JOIN discoveries d ON d.ghost_id = g.ghost_id AND d.player_id = ?1
       WHERE g.is_active = 1
       ORDER BY g.no ASC`,
    )
    .bind(playerId)
    .all<DexRow>()

  const dex = (results ?? []).map((row) => {
    const found = row.first_discovered_at != null
    return found
      ? {
          ghostId: row.ghost_id,
          no: row.no,
          found: true,
          name: row.name,
          desc: row.description,
          rarity: row.rarity,
          attribute: row.attribute,
          shape: row.shape,
          floor: row.floor,
          firstAt: row.first_discovered_at,
          lastAt: row.last_scanned_at,
          count: row.scan_count,
        }
      : {
          // 미발견: 번호와 등급(별 개수)만 노출. 이름·설명·실루엣 형태는 숨긴다.
          ghostId: row.ghost_id,
          no: row.no,
          found: false,
          rarity: row.rarity,
        }
  })

  const progress = levelProgress(player.xp)

  return ok({
    ok: true,
    player: {
      id: player.id,
      nickname: player.nickname,
      xp: player.xp,
      coins: player.coins,
      level: player.level,
      title: titleFromLevel(player.level),
      uniqueGhosts: player.unique_ghosts,
      totalCatches: player.total_catches,
      levelProgress: progress,
    },
    dex,
    totalGhosts: dex.length,
    prize: cfg.prize_enabled
      ? {
          enabled: true,
          threshold: cfg.prize_threshold,
          name: cfg.prize_name,
          unlocked: Boolean(player.prize_unlocked_at),
          claimed: Boolean(player.prize_claimed_at),
          claimedAt: player.prize_claimed_at,
          code: player.prize_code,
          remaining: Math.max(0, cfg.prize_threshold - player.unique_ghosts),
        }
      : { enabled: false },
    event: {
      status: cfg.status,
      open: gate.open,
      message: gate.message ?? null,
      startsAt: cfg.starts_at,
      endsAt: cfg.ends_at,
      rankingFrozen: Boolean(cfg.ranking_frozen),
    },
  })
}
