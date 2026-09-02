/**
 * GET /api/admin/data → 운영 대시보드에 필요한 전부를 한 번에
 *
 * 행사 중 폰으로 새로고침하며 볼 화면이라 왕복을 하나로 줄인다.
 */

import { type Env, loadEventConfig, kstDayStart } from '../../_lib/util'
import { requireAdmin, ok } from '../../_lib/admin'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await requireAdmin(request, env)
  if (denied) return denied

  const db = env.DB
  const now = Date.now()
  const dayStart = kstDayStart(now)
  const cfg = await loadEventConfig(db)

  const one = async <T>(sql: string, ...args: unknown[]) =>
    db.prepare(sql).bind(...args).first<T>()
  const many = async <T>(sql: string, ...args: unknown[]) =>
    (await db.prepare(sql).bind(...args).all<T>()).results ?? []

  /* --- 요약 ------------------------------------------------------------ */
  const stats = await one<{
    players: number
    today_players: number
    scans: number
    today_scans: number
    discoveries: number
    prize_unlocked: number
    prize_claimed: number
    today_claimed: number
  }>(
    `SELECT
       (SELECT COUNT(*) FROM players)                                              AS players,
       (SELECT COUNT(*) FROM players WHERE created_at >= ?1)                       AS today_players,
       (SELECT COUNT(*) FROM scan_logs WHERE result = 'ok')                        AS scans,
       (SELECT COUNT(*) FROM scan_logs WHERE result = 'ok' AND created_at >= ?1)   AS today_scans,
       (SELECT COUNT(*) FROM discoveries)                                          AS discoveries,
       (SELECT COUNT(*) FROM players WHERE prize_unlocked_at IS NOT NULL)          AS prize_unlocked,
       (SELECT COUNT(*) FROM players WHERE prize_claimed_at IS NOT NULL)           AS prize_claimed,
       (SELECT COUNT(*) FROM players WHERE prize_claimed_at >= ?1)                 AS today_claimed`,
    dayStart,
  )

  /* --- 이상 패턴: 최근 10분 수령 건수 ---------------------------------- */
  const burst = await one<{ c: number }>(
    'SELECT COUNT(*) c FROM players WHERE prize_claimed_at > ?1',
    now - 10 * 60_000,
  )

  /* --- 유령별 발견 현황 ------------------------------------------------ */
  const ghosts = await many<{
    ghost_id: string
    no: number
    name: string
    rarity: string
    floor: number
    finders: number
    scans: number
  }>(
    `SELECT g.ghost_id, g.no, g.name, g.rarity, g.floor,
            (SELECT COUNT(*) FROM discoveries d WHERE d.ghost_id = g.ghost_id) AS finders,
            (SELECT COALESCE(SUM(c.scan_count),0) FROM codes c WHERE c.ghost_id = g.ghost_id) AS scans
     FROM ghosts g ORDER BY g.no`,
  )

  /* --- QR 코드 상태 (스캔 0회 = 부착 위치나 인쇄 문제 의심) ------------ */
  const codes = await many<{
    slug: string
    ghost_id: string
    name: string
    placement: string | null
    is_active: number
    scan_count: number
  }>(
    `SELECT c.slug, c.ghost_id, g.name, c.placement, c.is_active, c.scan_count
     FROM codes c JOIN ghosts g ON g.ghost_id = c.ghost_id
     ORDER BY c.scan_count ASC, g.no ASC`,
  )

  /* --- 참가자 (최근 활동순) -------------------------------------------- */
  const players = await many<{
    id: string
    nickname: string
    level: number
    xp: number
    unique_ghosts: number
    total_catches: number
    created_at: number
    last_active_at: number
    prize_unlocked_at: number | null
    prize_claimed_at: number | null
    prize_code: string | null
    is_blocked: number
  }>(
    `SELECT id, nickname, level, xp, unique_ghosts, total_catches,
            created_at, last_active_at, prize_unlocked_at, prize_claimed_at, prize_code, is_blocked
     FROM players ORDER BY last_active_at DESC LIMIT 100`,
  )

  /* --- 상품 수령 이력 --------------------------------------------------- */
  const claims = await many<{
    nickname: string
    prize_code: string | null
    unique_ghosts: number
    claimed_at: number
    created_at: number
  }>(
    `SELECT nickname, prize_code, unique_ghosts,
            prize_claimed_at AS claimed_at, created_at
     FROM players WHERE prize_claimed_at IS NOT NULL
     ORDER BY prize_claimed_at DESC LIMIT 60`,
  )

  /* --- 최근 스캔 (현장 진단용) ------------------------------------------ */
  const recent = await many<{
    nickname: string | null
    slug: string | null
    name: string | null
    is_new: number
    result: string
    created_at: number
  }>(
    `SELECT p.nickname, s.slug, g.name, s.is_new, s.result, s.created_at
     FROM scan_logs s
     LEFT JOIN players p ON p.id = s.player_id
     LEFT JOIN ghosts g ON g.ghost_id = s.ghost_id
     ORDER BY s.created_at DESC LIMIT 40`,
  )

  return ok({
    ok: true,
    now,
    dayStart,
    config: {
      status: cfg.status,
      startsAt: cfg.starts_at,
      endsAt: cfg.ends_at,
      prizeEnabled: Boolean(cfg.prize_enabled),
      prizeThreshold: cfg.prize_threshold,
      prizeName: cfg.prize_name,
      staffPin: cfg.staff_pin,
      duplicateXp: cfg.duplicate_xp,
      duplicateCoin: cfg.duplicate_coin,
      sameGhostCooldownSec: cfg.same_ghost_cooldown_sec,
      scanCooldownSec: cfg.scan_cooldown_sec,
      maxScansPerMin: cfg.max_scans_per_min,
    },
    stats: { ...stats, recentClaims10min: burst?.c ?? 0 },
    ghosts,
    codes,
    players,
    claims,
    recent,
  })
}
