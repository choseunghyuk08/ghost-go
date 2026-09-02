/**
 * GET /api/ranking?sort=xp|unique|total&scope=today|all
 *
 * 사양 §36·§37·§39·§42 + 학과체험 운영 조건 반영.
 *
 * 범위(scope):
 *   today (기본) — 나와 같은 날 참가한 학생끼리 겨룬다.
 *     학과체험은 매일 다른 학생이 방문하므로 3일 누적 랭킹은
 *     마지막 날 참가자가 절대 유리해 공정하지 않다. "오늘의 1등"이 맞다.
 *   all — 전체 명예의 전당 (행사 종료 후 전시용).
 *
 * 응답에는 항상 "내 순위"가 포함된다. 내가 하위권이어도 화면에 고정 표시할 수 있어야
 * 학생이 이탈하지 않는다. 다음 순위까지 필요한 XP도 함께 내려보낸다.
 */

import { type Env, ok, fail, authenticate, loadEventConfig, kstDayStart } from '../_lib/util'
import { titleFromLevel } from '../../src/data/ghosts'

interface RankRow {
  id: string
  nickname: string
  level: number
  xp: number
  unique_ghosts: number
  total_catches: number
  created_at: number
}

/** 사양 §39: XP ↓ → 유령 종류 수 ↓ → 총 포획 수 ↓ → 먼저 가입한 사람 ↑ */
const ORDER_BY: Record<string, string> = {
  xp: 'xp DESC, unique_ghosts DESC, total_catches DESC, created_at ASC',
  unique: 'unique_ghosts DESC, xp DESC, total_catches DESC, created_at ASC',
  total: 'total_catches DESC, xp DESC, unique_ghosts DESC, created_at ASC',
}

const TOP_LIMIT = 20

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const playerId = await authenticate(request, env)
  if (!playerId) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)

  const db = env.DB
  const url = new URL(request.url)
  const sortKey = url.searchParams.get('sort') ?? 'xp'
  const orderBy = ORDER_BY[sortKey] ?? ORDER_BY.xp
  const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'today'

  const cfg = await loadEventConfig(db)

  const me = await db
    .prepare('SELECT * FROM players WHERE id = ?1')
    .bind(playerId)
    .first<RankRow>()
  if (!me) return fail('unauthenticated', '게임을 다시 시작해 주세요.', {}, 401)

  // 내가 참가한 날의 코호트 범위
  const dayStart = kstDayStart(me.created_at)
  const dayEnd = dayStart + 86_400_000
  const isToday = scope === 'today'
  const scopeClause = isToday ? 'AND created_at >= ? AND created_at < ?' : ''
  const scopeArgs: number[] = isToday ? [dayStart, dayEnd] : []

  /* --- 상위 목록 ---------------------------------------------------------- */
  const { results } = await db
    .prepare(
      `SELECT id, nickname, level, xp, unique_ghosts, total_catches, created_at
       FROM players WHERE is_blocked = 0 ${scopeClause}
       ORDER BY ${orderBy} LIMIT ${TOP_LIMIT}`,
    )
    .bind(...scopeArgs)
    .all<RankRow>()

  const top = (results ?? []).map((r, i) => ({
    rank: i + 1,
    isMe: r.id === playerId,
    nickname: r.nickname,
    level: r.level,
    title: titleFromLevel(r.level),
    xp: r.xp,
    uniqueGhosts: r.unique_ghosts,
    totalCatches: r.total_catches,
  }))

  /* --- 내 순위 (§39 정렬 기준과 동일하게 계산) ----------------------------- */
  const aheadRow = await db
    .prepare(
      `SELECT COUNT(*) AS ahead FROM players
       WHERE is_blocked = 0 ${scopeClause} AND (
         xp > ?${scopeArgs.length + 1}
         OR (xp = ?${scopeArgs.length + 1} AND unique_ghosts > ?${scopeArgs.length + 2})
         OR (xp = ?${scopeArgs.length + 1} AND unique_ghosts = ?${scopeArgs.length + 2}
             AND total_catches > ?${scopeArgs.length + 3})
         OR (xp = ?${scopeArgs.length + 1} AND unique_ghosts = ?${scopeArgs.length + 2}
             AND total_catches = ?${scopeArgs.length + 3} AND created_at < ?${scopeArgs.length + 4})
       )`,
    )
    .bind(...scopeArgs, me.xp, me.unique_ghosts, me.total_catches, me.created_at)
    .first<{ ahead: number }>()

  const myRank = (aheadRow?.ahead ?? 0) + 1

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM players WHERE is_blocked = 0 ${scopeClause}`)
    .bind(...scopeArgs)
    .first<{ c: number }>()

  /* --- 바로 위 순위와의 격차 → 참여 동기 (§37) ---------------------------- */
  const above = await db
    .prepare(
      `SELECT xp, nickname FROM players
       WHERE is_blocked = 0 ${scopeClause} AND xp > ?${scopeArgs.length + 1}
       ORDER BY xp ASC LIMIT 1`,
    )
    .bind(...scopeArgs, me.xp)
    .first<{ xp: number; nickname: string }>()

  const gapXp = above ? above.xp - me.xp + 1 : 0

  let hint: string | null = null
  if (myRank === 1) hint = '오늘의 1등이에요! 계속 지켜 보세요 👑'
  else if (above) hint = `${gapXp.toLocaleString()} XP만 더 모으면 ${myRank - 1}위로 올라가요!`

  return ok({
    ok: true,
    sort: sortKey,
    scope,
    frozen: Boolean(cfg.ranking_frozen),
    dayStart,
    top,
    totalPlayers: totalRow?.c ?? 0,
    me: {
      rank: myRank,
      nickname: me.nickname,
      level: me.level,
      title: titleFromLevel(me.level),
      xp: me.xp,
      uniqueGhosts: me.unique_ghosts,
      totalCatches: me.total_catches,
      gapXp,
      hint,
    },
  })
}
