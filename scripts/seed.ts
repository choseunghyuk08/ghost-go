/**
 * 시드 SQL 생성기
 *
 *   node --experimental-strip-types scripts/seed.ts > seed.sql
 *
 * 유령 데이터는 src/data/ghosts.ts 한 곳에서만 읽는다.
 * (설계 검증에서 "기획 축과 DB 축이 서로 다른 20종을 확정"한 치명 이슈가 나왔다.
 *  단일 원본을 강제해 재발을 막는다.)
 *
 * 카드 장수: 학과체험 실제 조건(동시 접속 20명 이하)에서는 유령당 1장이면 충분하다.
 * 대기열이 생기지 않으므로 다중화는 불필요. 예비 카드는 인쇄만 해 두고 부착하지 않는다.
 */

import { GHOSTS } from '../src/data/ghosts.ts'
import { devSlug } from '../src/lib/slug.ts'

const CARDS_PER_GHOST = Number(process.env.CARDS_PER_GHOST ?? 1)

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

const lines: string[] = []
lines.push('-- 자동 생성 파일. 직접 수정하지 말고 scripts/seed.ts 를 고치세요.')
lines.push('-- 생성: node --experimental-strip-types scripts/seed.ts > seed.sql')
lines.push('')
lines.push('DELETE FROM codes;')
lines.push('DELETE FROM ghosts;')
lines.push('')

// --- 유령 20종 -------------------------------------------------------------
lines.push(
  '-- 유령 20종. active_from/active_until 은 NULL = 상시 활성.',
  '-- 학과체험은 매일 다른 학생이 오므로 등급 순차 해금을 쓰지 않는다.',
)
for (const g of GHOSTS) {
  lines.push(
    `INSERT INTO ghosts (ghost_id, no, name, description, rarity, attribute, shape, floor, xp_reward, coin_reward, is_active, active_from, active_until) VALUES (` +
      [
        q(g.ghostId),
        g.no,
        q(g.name),
        q(g.desc),
        q(g.rarity),
        q(g.attribute),
        q(g.shape),
        g.floor,
        g.xpReward,
        g.coinReward,
        1,
        'NULL',
        'NULL',
      ].join(', ') +
      ');',
  )
}
lines.push('')

// --- QR 코드 ---------------------------------------------------------------
lines.push(`-- QR 코드 (유령당 ${CARDS_PER_GHOST}장)`)
const seen = new Set<string>()
for (const g of GHOSTS) {
  for (let copy = 1; copy <= CARDS_PER_GHOST; copy++) {
    const slug = devSlug(g.ghostId, copy)
    if (seen.has(slug)) throw new Error(`슬러그 충돌: ${slug} (${g.ghostId} #${copy})`)
    seen.add(slug)
    lines.push(
      `INSERT INTO codes (slug, ghost_id, copy_no, placement, is_active, scan_count) VALUES (` +
        [q(slug), q(g.ghostId), copy, q(g.placement), 1, 0].join(', ') +
        ');',
    )
  }
}
lines.push('')
lines.push("UPDATE event_config SET status = 'running' WHERE id = 1;")

console.log(lines.join('\n'))

// 사람이 읽을 요약은 stderr 로 (stdout 은 순수 SQL 이어야 파이프가 깨지지 않는다)
const byRarity: Record<string, number> = {}
const byFloor: Record<number, number> = {}
for (const g of GHOSTS) {
  byRarity[g.rarity] = (byRarity[g.rarity] ?? 0) + 1
  byFloor[g.floor] = (byFloor[g.floor] ?? 0) + 1
}
console.error(`유령 ${GHOSTS.length}종 / 코드 ${seen.size}개`)
console.error('등급:', JSON.stringify(byRarity))
console.error('층별:', JSON.stringify(byFloor))
const totalXp = GHOSTS.reduce((s, g) => s + g.xpReward, 0)
console.error(`20종 완주 XP: ${totalXp}`)
