/**
 * 상품 지급 흐름 검증
 *
 *   npm run build && npx wrangler pages dev --port 8788   (다른 터미널)
 *   node scripts/test-prize.mjs [API주소] [스태프PIN]
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
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}\n     → ${detail}`) }
}

const u = Date.now().toString(36).slice(-5)
const reg = await post('/register', { nickname: 'P' + u })
const T = reg.token
if (!T) { console.log('가입 실패:', reg); process.exit(1) }
console.log(`플레이어: ${reg.player.nickname}\n`)

console.log('[1] 기준 미달 상태')
let st = await get('/state', T)
const TH = st.prize.threshold
check(`상품 활성 (기준 ${TH}마리)`, st.prize.enabled === true, JSON.stringify(st.prize))
check('아직 미달성', st.prize.unlocked === false, `unlocked=${st.prize.unlocked}`)
check(`남은 수 ${TH}`, st.prize.remaining === TH, `remaining=${st.prize.remaining}`)

console.log(`\n[2] 기준 직전까지 스캔 (${TH - 1}마리)`)
for (let i = 0; i < TH - 1; i++) {
  const r = await post('/scan', { slug: slugs[i], idem: `p${i}-${u}` }, T)
  console.log(`     ${i + 1}. ${r.ghost?.name} — 남은 ${r.prize?.remaining}`)
  await wait(3300)
}
st = await get('/state', T)
check('아직 교환권 없음', st.prize.unlocked === false, `unlocked=${st.prize.unlocked}`)
check('남은 수 1', st.prize.remaining === 1, `remaining=${st.prize.remaining}`)

console.log(`\n[3] ${TH}마리째 → 교환권 발급`)
const hit = await post('/scan', { slug: slugs[TH - 1], idem: `hit-${u}` }, T)
check('이번 스캔에서 달성', hit.prize?.justUnlocked === true, JSON.stringify(hit.prize))
check('교환권 번호 발급', typeof hit.prize?.code === 'string' && hit.prize.code.length === 4, `code=${hit.prize?.code}`)
check('미수령 상태', hit.prize?.claimed === false, `claimed=${hit.prize?.claimed}`)
console.log(`     교환권: ${hit.prize?.code} / ${hit.prize?.name}`)

console.log('\n[4] 재조회 시 justUnlocked 는 꺼져야 함')
st = await get('/state', T)
check('unlocked 유지', st.prize.unlocked === true, `unlocked=${st.prize.unlocked}`)
check('code 유지', st.prize.code === hit.prize?.code, `${st.prize.code} vs ${hit.prize?.code}`)

console.log('\n[5] 잘못된 PIN')
const bad = await post('/prize', { pin: '0001' }, T)
check('거부됨', bad.ok === false && bad.reason === 'bad_pin', JSON.stringify(bad))
st = await get('/state', T)
check('여전히 미수령', st.prize.claimed === false, `claimed=${st.prize.claimed}`)

console.log('\n[6] 올바른 PIN → 수령 확정')
const okc = await post('/prize', { pin: PIN }, T)
check('수령 성공', okc.ok === true, JSON.stringify(okc))
check('수령 시각 기록', typeof okc.claimedAt === 'number', `claimedAt=${okc.claimedAt}`)

console.log('\n[7] 중복 수령 차단 (핵심)')
const dup = await post('/prize', { pin: PIN }, T)
check('두 번째 수령 거부', dup.ok === false && dup.reason === 'already', JSON.stringify(dup))
st = await get('/state', T)
check('상태가 수령완료로 고정', st.prize.claimed === true, `claimed=${st.prize.claimed}`)

console.log('\n[8] 기준 미달 계정은 수령 불가')
const r2 = await post('/register', { nickname: 'Q' + u })
const other = await post('/prize', { pin: PIN }, r2.token)
check('미달성 계정 거부', other.ok === false && other.reason === 'not_unlocked', JSON.stringify(other))

console.log(`\n${'─'.repeat(50)}`)
console.log(`통과 ${pass} / 실패 ${fail}`)
process.exit(fail ? 1 : 0)
