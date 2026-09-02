/**
 * 상품 수령 이후에도 게임이 계속되는지 검증
 *   node scripts/test-after-claim.mjs [API주소] [스태프PIN]
 */
import fs from 'node:fs'
import path from 'node:path'

const API = process.argv[2] || 'http://127.0.0.1:8788/api'
const PIN = process.argv[3] || '0000'

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return { _raw: t.slice(0, 200) } } }
const post = (p, b, t) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }).then(j)
const get = (p, t) => fetch(API + p, { headers: t ? { authorization: 'Bearer ' + t } : {} }).then(j)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const seed = fs.readFileSync(path.join(import.meta.dirname, '..', 'seed.sql'), 'utf8')
const slugs = [...seed.matchAll(/VALUES \('(GG1-[0-9A-Z]{10})'/g)].map((m) => m[1])

let pass = 0, fail = 0
const check = (n, c, d) => { if (c) { pass++; console.log(`  ✅ ${n}`) } else { fail++; console.log(`  ❌ ${n}\n     → ${d}`) } }

const u = Date.now().toString(36).slice(-5)
const reg = await post('/register', { nickname: 'C' + u })
const T = reg.token
console.log(`플레이어: ${reg.player.nickname}\n`)

// 기준까지 스캔
let st = await get('/state', T)
const TH = st.prize.threshold
console.log(`[준비] 유령 ${TH}마리 수집 → 교환권 발급`)
for (let i = 0; i < TH; i++) {
  await post('/scan', { slug: slugs[i], idem: `a${i}-${u}` }, T)
  if (i < TH - 1) await wait(3300)
}
st = await get('/state', T)
check('교환권 발급됨', st.prize.unlocked === true, `unlocked=${st.prize.unlocked}`)
const xpBefore = st.player.xp
const dexBefore = st.player.uniqueGhosts
console.log(`     XP ${xpBefore} / 도감 ${dexBefore}종`)

console.log('\n[수령] 스태프 PIN 으로 확정')
const claim = await post('/prize', { pin: PIN }, T)
check('수령 완료', claim.ok === true, JSON.stringify(claim))

console.log('\n[핵심] 수령 후에도 계속 수집되는가')
await wait(3300)
const r5 = await post('/scan', { slug: slugs[TH], idem: `b1-${u}` }, T)
check('5번째 유령 스캔 성공', r5.ok === true, JSON.stringify(r5).slice(0, 120))
check('신규 발견 인정', r5.isNew === true, `isNew=${r5.isNew}`)
check('XP 정상 적립', r5.totalXp > xpBefore, `${xpBefore} → ${r5.totalXp}`)
check('도감 증가', r5.uniqueGhosts === dexBefore + 1, `${dexBefore} → ${r5.uniqueGhosts}`)

await wait(3300)
const r6 = await post('/scan', { slug: slugs[TH + 1], idem: `b2-${u}` }, T)
check('6번째도 정상', r6.ok === true && r6.isNew === true, JSON.stringify(r6).slice(0, 100))

await wait(3300)
const r7 = await post('/scan', { slug: slugs[TH + 2], idem: `b3-${u}` }, T)
check('7번째도 정상', r7.ok === true && r7.isNew === true, JSON.stringify(r7).slice(0, 100))

console.log('\n[상태] 수령 이후 상태 확인')
st = await get('/state', T)
check('수령 완료 유지', st.prize.claimed === true, `claimed=${st.prize.claimed}`)
check('교환권 재발급 안 됨', st.prize.code === claim.code, `${st.prize.code} vs ${claim.code}`)
check(`도감 ${TH + 3}종`, st.player.uniqueGhosts === TH + 3, `unique=${st.player.uniqueGhosts}`)
check('XP 계속 증가', st.player.xp > xpBefore, `${xpBefore} → ${st.player.xp}`)
console.log(`     최종: Lv.${st.player.level} / XP ${st.player.xp} / 도감 ${st.player.uniqueGhosts}종 / 코인 ${st.player.coins}`)

console.log('\n[랭킹] 수령자도 랭킹에 계속 반영되는가')
const rk = await get('/ranking', T)
check('랭킹에 표시됨', rk.ok === true && rk.me.uniqueGhosts === TH + 3, `me=${JSON.stringify(rk.me)}`)

console.log(`\n${'─'.repeat(50)}`)
console.log(`통과 ${pass} / 실패 ${fail}`)
process.exit(fail ? 1 : 0)
