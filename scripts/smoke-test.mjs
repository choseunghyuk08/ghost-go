/**
 * 스모크 테스트 — 서버 게임 로직 회귀 검사
 *
 *   npm run build && npx wrangler pages dev --port 8788   (다른 터미널)
 *   npm run test:smoke
 *
 * 실제 HTTP 요청으로 검사한다. 화면 없이도 게임 규칙이 깨졌는지 바로 알 수 있다.
 * seed.sql 이 필요하므로 먼저 `npm run db:seed && npm run db:init` 을 돌릴 것.
 */

import fs from 'node:fs'
import path from 'node:path'

const API = 'http://127.0.0.1:8788/api'
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return { _raw: t.slice(0, 200) } } }
const post = (p, b, t) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }).then(j)
const get = (p, t) => fetch(API + p, { headers: t ? { authorization: 'Bearer ' + t } : {} }).then(j)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const seed = fs.readFileSync(path.join(import.meta.dirname, '..', 'seed.sql'), 'utf8')
const slugOf = (g) => seed.match(new RegExp("VALUES \\('(GG1-[0-9A-Z]{10})', '" + g + "'"))[1]
const S1 = slugOf('GHOST_001')
const S2 = slugOf('GHOST_002')

let pass = 0, fail = 0
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}\n     → ${detail}`) }
}

const u = Date.now().toString(36).slice(-5)
const reg = await post('/register', { nickname: 'V' + u })
const T = reg.token
console.log(`플레이어: ${reg.player.nickname}\n`)

// ─────────────────────────────────────────────────────────────
console.log('[수정1] 같은 멱등키 재전송 → 보상 1회만')
const IDEM = 'fixed-key-' + u
const a1 = await post('/scan', { slug: S1, idem: IDEM }, T)
await wait(3300)
const a2 = await post('/scan', { slug: S1, idem: IDEM }, T)
const st1 = await get('/state', T)

check('첫 스캔 신규 인정', a1.isNew === true, `isNew=${a1.isNew}`)
check('첫 스캔 +100 XP', a1.xpGained === 100, `xpGained=${a1.xpGained}`)
check('재전송이 replayed 로 표시', a2.replayed === true, `replayed=${a2.replayed}`)
check('XP 가 100 그대로 (중복지급 없음)', st1.player.xp === 100, `xp=${st1.player.xp}`)
check('포획 수 1 유지', st1.player.totalCatches === 1, `totalCatches=${st1.player.totalCatches}`)

// ─────────────────────────────────────────────────────────────
console.log('\n[수정2] 보상 거부된 중복 스캔 → 포획 수 증가 안 함')
const before = (await get('/state', T)).player
await wait(3300)
const b1 = await post('/scan', { slug: S1, idem: 'dup1-' + u }, T)   // 60초 내 같은 유령
const after = (await get('/state', T)).player

check('중복으로 판정', b1.isNew === false, `isNew=${b1.isNew}`)
check('보상 거부됨', b1.rewarded === false, `rewarded=${b1.rewarded}`)
check('XP 증가 없음', after.xp === before.xp, `${before.xp} → ${after.xp}`)
check('포획 수 증가 없음 (어뷰즈 차단)', after.totalCatches === before.totalCatches,
  `${before.totalCatches} → ${after.totalCatches}`)
check('중복 대사 있음', typeof b1.duplicateLine === 'string', `duplicateLine=${b1.duplicateLine}`)

// ─────────────────────────────────────────────────────────────
console.log('\n[회귀] 다른 유령은 정상 적립')
await wait(3300)
const c1 = await post('/scan', { slug: S2, idem: 'g2-' + u }, T)
const st3 = (await get('/state', T)).player

check('두 번째 유령 신규', c1.isNew === true, `isNew=${c1.isNew}`)
check('XP 200 누적', st3.xp === 200, `xp=${st3.xp}`)
check('종류 2', st3.uniqueGhosts === 2, `unique=${st3.uniqueGhosts}`)
check('포획 수 2', st3.totalCatches === 2, `totalCatches=${st3.totalCatches}`)

// ─────────────────────────────────────────────────────────────
console.log('\n[회귀] 도감 스포일러 차단')
const dex = (await get('/state', T)).dex
const hidden = dex.find((d) => !d.found)
check('미발견에 이름 없음', hidden.name === undefined, `keys=${Object.keys(hidden)}`)
check('미발견에 설명 없음', hidden.desc === undefined, `keys=${Object.keys(hidden)}`)
check('미발견에 실루엣 형태 없음', hidden.shape === undefined, `keys=${Object.keys(hidden)}`)

console.log('\n[회귀] 인증·입력 검증')
check('위조 토큰 거부', (await post('/scan', { slug: S1 }, 'BAD.SIG')).reason === 'unauthenticated')
check('미등록 슬러그 거부', (await post('/scan', { slug: 'GG1-AAAAAAAAAA', idem: 'x' + u }, T)).reason !== undefined)
check('13자 닉네임 거부', (await post('/register', { nickname: '가나다라마바사아자차카타파' })).ok === false)
check('1자 닉네임 거부', (await post('/register', { nickname: 'ㄱ' })).ok === false)
check('12자 닉네임 허용', (await post('/register', { nickname: ('한글닉' + u + 'abcd').slice(0, 12) })).ok === true)

console.log(`\n${'─'.repeat(50)}`)
console.log(`통과 ${pass} / 실패 ${fail}`)
process.exit(fail ? 1 : 0)
