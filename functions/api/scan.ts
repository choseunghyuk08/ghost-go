/**
 * POST /api/scan  { slug, idem }
 *
 * 게임의 심장. 모든 판정을 여기서만 한다 — 클라이언트는 결과만 받는다.
 *  - 이벤트 열림 여부
 *  - 코드/유령 활성 여부 (해금 시간 포함)
 *  - 멱등성 (네트워크 재시도로 인한 중복 지급 차단)
 *  - 연타·어뷰즈 제한
 *  - 신규/중복 판정과 보상 계산
 *  - XP·코인·레벨·카운터 갱신, 도감 기록, 원장 기록
 *  - 스캔 직후 랭킹 (사양 §37·§38)
 */

import { levelFromXp } from '../../src/data/ghosts'
import {
  type Env,
  type EventRow,
  ok,
  fail,
  authenticate,
  loadEventConfig,
  eventGate,
  kstDayStart,
} from '../_lib/util'

const SLUG_RE = /^GG1-[0-9A-HJKMNP-TV-Z]{10}$/

interface PlayerRow {
  id: string
  nickname: string
  xp: number
  coins: number
  level: number
  unique_ghosts: number
  total_catches: number
  created_at: number
  last_scan_at: number | null
  is_blocked: number
}

interface CodeRow {
  slug: string
  ghost_id: string
  code_active: number
  ghost_active: number
  active_from: number | null
  active_until: number | null
  no: number
  name: string
  description: string
  rarity: string
  attribute: string
  shape: string
  floor: number
  xp_reward: number
  coin_reward: number
}

/** 중복 발견 시 보여줄 대사 — 중복도 콘텐츠가 되도록 (기획서 PART 1 §1-6) */
const DUP_LINES = [
  '"또 왔네?" 유령이 시큰둥하게 쳐다본다.',
  '"아까 봤잖아." 유령이 손을 흔든다.',
  '유령이 살짝 웃으며 자리를 비켜 준다.',
  '"다른 친구들도 찾아봐." 유령이 복도 쪽을 가리킨다.',
  '유령이 하품을 한다. 익숙한 얼굴인 모양이다.',
]

/**
 * 현재 순위 계산 — 사양 §39 정렬 기준과 정확히 동일해야 한다.
 * 범위는 '같은 날 참가자'로 제한한다 (학과체험은 매일 다른 학생이 방문하므로
 * 누적 랭킹은 마지막 날 참가자에게 절대 유리하다). /api/ranking 과 반드시 일치시킬 것.
 */
async function computeRank(
  db: D1Database,
  p: { xp: number; unique_ghosts: number; total_catches: number; created_at: number },
  dayStart: number,
  dayEnd: number,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS ahead FROM players
       WHERE is_blocked = 0 AND created_at >= ?5 AND created_at < ?6 AND (
         xp > ?1
         OR (xp = ?1 AND unique_ghosts > ?2)
         OR (xp = ?1 AND unique_ghosts = ?2 AND total_catches > ?3)
         OR (xp = ?1 AND unique_ghosts = ?2 AND total_catches = ?3 AND created_at < ?4)
       )`,
    )
    .bind(p.xp, p.unique_ghosts, p.total_catches, p.created_at, dayStart, dayEnd)
    .first<{ ahead: number }>()
  return (row?.ahead ?? 0) + 1
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const playerId = await authenticate(request, env)
  if (!playerId) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)

  let body: { slug?: unknown; idem?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', '요청을 이해하지 못했어요.')
  }

  const slug = String(body.slug ?? '').toUpperCase().trim()
  const idem = typeof body.idem === 'string' && body.idem.length <= 64 ? body.idem : null
  const now = Date.now()

  const db = env.DB

  /* --- 0. 멱등성: 같은 재시도는 첫 결과를 그대로 돌려준다 (모순 8 대응) ---- */
  if (idem) {
    const prev = await db
      .prepare(
        `SELECT s.*, g.no, g.name, g.description, g.rarity, g.attribute, g.shape, g.floor
         FROM scan_logs s LEFT JOIN ghosts g ON g.ghost_id = s.ghost_id
         WHERE s.player_id = ?1 AND s.idem_key = ?2 LIMIT 1`,
      )
      .bind(playerId, idem)
      .first<Record<string, unknown>>()
    if (prev) {
      if (prev.result !== 'ok') {
        return fail(String(prev.result), '이미 처리된 스캔이에요.', { replayed: true })
      }
      const p = await db
        .prepare('SELECT * FROM players WHERE id = ?1')
        .bind(playerId)
        .first<PlayerRow>()
      return ok({
        ok: true,
        replayed: true,
        isNew: Boolean(prev.is_new),
        ghost: {
          ghostId: prev.ghost_id,
          no: prev.no,
          name: prev.name,
          desc: prev.description,
          rarity: prev.rarity,
          attribute: prev.attribute,
          shape: prev.shape,
          floor: prev.floor,
        },
        xpGained: prev.xp_gained,
        coinGained: prev.coin_gained,
        levelBefore: p?.level ?? 1,
        levelAfter: p?.level ?? 1,
        totalXp: p?.xp ?? 0,
        totalCoins: p?.coins ?? 0,
        uniqueGhosts: p?.unique_ghosts ?? 0,
        totalCatches: p?.total_catches ?? 0,
      })
    }
  }

  /* --- 1. 플레이어 --------------------------------------------------------- */
  const player = await db
    .prepare('SELECT * FROM players WHERE id = ?1')
    .bind(playerId)
    .first<PlayerRow>()
  if (!player) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)
  if (player.is_blocked) return fail('blocked', '참여가 제한된 계정이에요. 운영자에게 문의해 주세요.')

  const cfg: EventRow = await loadEventConfig(db)

  const logFail = async (reason: string) => {
    await db
      .prepare(
        `INSERT OR IGNORE INTO scan_logs (player_id, slug, ghost_id, is_new, xp_gained, coin_gained, result, idem_key, created_at)
         VALUES (?1, ?2, NULL, 0, 0, 0, ?3, ?4, ?5)`,
      )
      .bind(playerId, slug || null, reason, idem, now)
      .run()
  }

  /* --- 2. 이벤트 게이트 ---------------------------------------------------- */
  const gate = eventGate(cfg, now)
  if (!gate.open) {
    await logFail(gate.reason!)
    return fail(gate.reason!, gate.message!)
  }

  /* --- 3. 코드 형식 -------------------------------------------------------- */
  if (!SLUG_RE.test(slug)) {
    await logFail('not_found')
    return fail('not_found', '고스트 GO의 유령 QR이 아니에요.')
  }

  /* --- 4. 연타·어뷰즈 제한 ------------------------------------------------- */
  if (player.last_scan_at && now - player.last_scan_at < cfg.scan_cooldown_sec * 1000) {
    return fail('cooldown', '조금만 천천히! 잠시 후 다시 스캔해 주세요.', {
      retryAfterSec: Math.ceil((cfg.scan_cooldown_sec * 1000 - (now - player.last_scan_at)) / 1000),
    })
  }
  const recent = await db
    .prepare('SELECT COUNT(*) AS c FROM scan_logs WHERE player_id = ?1 AND created_at > ?2')
    .bind(playerId, now - 60_000)
    .first<{ c: number }>()
  if ((recent?.c ?? 0) >= cfg.max_scans_per_min) {
    await logFail('rate_limited')
    return fail('rate_limited', '너무 빠르게 스캔하고 있어요. 잠시 쉬었다 해요!', { retryAfterSec: 30 })
  }

  /* --- 5. 코드 조회 -------------------------------------------------------- */
  const code = await db
    .prepare(
      `SELECT c.slug, c.ghost_id, c.is_active AS code_active,
              g.is_active AS ghost_active, g.active_from, g.active_until,
              g.no, g.name, g.description, g.rarity, g.attribute, g.shape, g.floor,
              g.xp_reward, g.coin_reward
       FROM codes c JOIN ghosts g ON g.ghost_id = c.ghost_id
       WHERE c.slug = ?1`,
    )
    .bind(slug)
    .first<CodeRow>()

  if (!code) {
    await logFail('not_found')
    return fail('not_found', '알 수 없는 유령이에요. QR을 다시 확인해 주세요.')
  }
  if (!code.code_active || !code.ghost_active) {
    await logFail('ghost_inactive')
    return fail('ghost_inactive', '지금은 잠들어 있는 유령이에요.')
  }
  if (code.active_from && now < code.active_from) {
    await logFail('ghost_inactive')
    return fail('ghost_inactive', '아직 나타나지 않은 유령이에요. 조금 뒤에 다시 와 보세요!')
  }
  if (code.active_until && now > code.active_until) {
    await logFail('ghost_inactive')
    return fail('ghost_inactive', '이미 사라진 유령이에요...')
  }

  /* --- 6. 신규/중복 판정 --------------------------------------------------- */
  const disc = await db
    .prepare('SELECT * FROM discoveries WHERE player_id = ?1 AND ghost_id = ?2')
    .bind(playerId, code.ghost_id)
    .first<{ first_discovered_at: number; last_scanned_at: number; scan_count: number }>()

  const isNew = !disc
  let xpGain = 0
  let coinGain = 0
  let rewarded = true

  if (isNew) {
    xpGain = code.xp_reward
    coinGain = code.coin_reward
  } else {
    // 사양 §40: 동일 유령을 짧은 시간에 반복 스캔하면 보상 없음
    const sinceLast = now - disc!.last_scanned_at
    const sameDay = kstDayStart(now) === kstDayStart(disc!.last_scanned_at)
    if (!cfg.duplicate_reward_enabled) rewarded = false
    else if (sinceLast < cfg.same_ghost_cooldown_sec * 1000) rewarded = false
    else if (cfg.same_ghost_daily_limit && sameDay) rewarded = false

    if (rewarded) {
      xpGain = cfg.duplicate_xp
      coinGain = cfg.duplicate_coin
    }
  }

  /* --- 7. 반영 (원자적 배치) ---------------------------------------------- */
  const newXp = player.xp + xpGain
  const levelBefore = player.level
  const levelAfter = levelFromXp(newXp)
  const newUnique = player.unique_ghosts + (isNew ? 1 : 0)
  const newCatches = player.total_catches + 1

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE players SET xp = ?2, coins = coins + ?3, level = ?4,
                            unique_ghosts = ?5, total_catches = ?6,
                            last_scan_at = ?7, last_active_at = ?7
         WHERE id = ?1`,
      )
      .bind(playerId, newXp, coinGain, levelAfter, newUnique, newCatches, now),
    db
      .prepare(
        `INSERT INTO discoveries (player_id, ghost_id, first_discovered_at, last_scanned_at, scan_count)
         VALUES (?1, ?2, ?3, ?3, 1)
         ON CONFLICT(player_id, ghost_id) DO UPDATE
           SET last_scanned_at = ?3, scan_count = scan_count + 1`,
      )
      .bind(playerId, code.ghost_id, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO scan_logs (player_id, slug, ghost_id, is_new, xp_gained, coin_gained, result, idem_key, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'ok', ?7, ?8)`,
      )
      .bind(playerId, slug, code.ghost_id, isNew ? 1 : 0, xpGain, coinGain, idem, now),
    db.prepare('UPDATE codes SET scan_count = scan_count + 1 WHERE slug = ?1').bind(slug),
  ]

  await db.batch(statements)

  /* --- 8. 스캔 직후 랭킹 (사양 §37·§38) — 당일 참가자 기준 ----------------- */
  const dayStart = kstDayStart(player.created_at)
  const dayEnd = dayStart + 86_400_000
  const rank = await computeRank(
    db,
    { xp: newXp, unique_ghosts: newUnique, total_catches: newCatches, created_at: player.created_at },
    dayStart,
    dayEnd,
  )
  const rankBefore = await computeRank(
    db,
    {
      xp: player.xp,
      unique_ghosts: player.unique_ghosts,
      total_catches: player.total_catches,
      created_at: player.created_at,
    },
    dayStart,
    dayEnd,
  )

  const totalGhosts = await db
    .prepare('SELECT COUNT(*) AS c FROM ghosts WHERE is_active = 1')
    .first<{ c: number }>()

  return ok({
    ok: true,
    isNew,
    rewarded,
    ghost: {
      ghostId: code.ghost_id,
      no: code.no,
      name: code.name,
      desc: code.description,
      rarity: code.rarity,
      attribute: code.attribute,
      shape: code.shape,
      floor: code.floor,
    },
    xpGained: xpGain,
    coinGained: coinGain,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    totalXp: newXp,
    totalCoins: player.coins + coinGain,
    uniqueGhosts: newUnique,
    totalCatches: newCatches,
    totalGhosts: totalGhosts?.c ?? 20,
    rank,
    rankBefore,
    rankUp: rank < rankBefore,
    duplicateLine: isNew ? undefined : DUP_LINES[Math.floor(now / 1000) % DUP_LINES.length],
  })
}
