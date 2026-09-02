/**
 * 운영 화면 보안·기능 검증
 *   node scripts/test-ops.mjs [사이트주소] [관리자비밀번호]
 */

const BASE = (process.argv[2] || 'https://ghost-go.pages.dev').replace(/\/+$/, '')
const PW = process.argv[3] || ''

let pass = 0, fail = 0
const check = (n, c, d) => { if (c) { pass++; console.log(`  ✅ ${n}`) } else { fail++; console.log(`  ❌ ${n}\n     → ${d}`) } }

const call = async (path, init = {}, cookie) => {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...init.headers },
    redirect: 'manual',
  })
  let j = null
  try { j = await r.json() } catch { /* 본문 없음 */ }
  return { status: r.status, body: j, setCookie: r.headers.get('set-cookie') }
}

console.log(`대상: ${BASE}\n`)

console.log('[보안] 로그인 없이 접근')
const noAuth = await call('/api/admin/data')
check('데이터 API 차단 (401)', noAuth.status === 401, `status=${noAuth.status}`)
check('데이터가 새지 않음', !noAuth.body?.players && !noAuth.body?.stats, JSON.stringify(noAuth.body).slice(0, 100))

const noAuthCfg = await call('/api/admin/config', { method: 'POST', body: JSON.stringify({ action: 'event', status: 'ended' }) })
check('설정 변경 차단 (401)', noAuthCfg.status === 401, `status=${noAuthCfg.status}`)

console.log('\n[보안] 잘못된 비밀번호')
const bad = await call('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'wrong-password-xyz' }) })
check('거부됨', bad.body?.ok === false, JSON.stringify(bad.body))
check('쿠키 발급 안 됨', !bad.setCookie, `setCookie=${bad.setCookie}`)

console.log('\n[보안] 위조 쿠키')
const forged = await call('/api/admin/data', {}, 'ggops=eyJleHAiOjk5OTk5OTk5OTk5OTl9.ZmFrZQ')
check('위조 쿠키 거부', forged.status === 401, `status=${forged.status}`)

if (!PW) { console.log('\n비밀번호가 없어 로그인 이후 테스트는 건너뜁니다.'); process.exit(fail ? 1 : 0) }

console.log('\n[기능] 정상 로그인')
const login = await call('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: PW }) })
check('로그인 성공', login.body?.ok === true, JSON.stringify(login.body))
check('HttpOnly 쿠키 발급', /HttpOnly/i.test(login.setCookie ?? ''), `setCookie=${login.setCookie}`)
check('Secure 플래그', /Secure/i.test(login.setCookie ?? ''), `setCookie=${login.setCookie}`)
const cookie = (login.setCookie ?? '').split(';')[0]

console.log('\n[기능] 대시보드 데이터')
const data = await call('/api/admin/data', {}, cookie)
check('데이터 조회', data.body?.ok === true, JSON.stringify(data.body).slice(0, 120))
check('요약 통계 포함', typeof data.body?.stats?.players === 'number', JSON.stringify(data.body?.stats))
check('상품 현황 포함', typeof data.body?.stats?.prize_claimed === 'number', JSON.stringify(data.body?.stats))
check('QR 20개', data.body?.codes?.length === 20, `codes=${data.body?.codes?.length}`)
check('유령 20종', data.body?.ghosts?.length === 20, `ghosts=${data.body?.ghosts?.length}`)
check('설정 노출', typeof data.body?.config?.prizeThreshold === 'number', JSON.stringify(data.body?.config))

console.log('\n[기능] 설정 변경')
const orig = data.body.config
const up = await call('/api/admin/config', { method: 'POST', body: JSON.stringify({ action: 'prize', prizeThreshold: 6 }) }, cookie)
check('기준 6마리로 변경', up.body?.ok === true && up.body?.config?.prize_threshold === 6, JSON.stringify(up.body?.config?.prize_threshold))

const back = await call('/api/admin/config', { method: 'POST', body: JSON.stringify({ action: 'prize', prizeThreshold: orig.prizeThreshold }) }, cookie)
check(`원래 값(${orig.prizeThreshold})으로 복구`, back.body?.config?.prize_threshold === orig.prizeThreshold, JSON.stringify(back.body?.config?.prize_threshold))

console.log('\n[기능] 잘못된 값 거부')
const badVal = await call('/api/admin/config', { method: 'POST', body: JSON.stringify({ action: 'prize', prizeThreshold: 999 }) }, cookie)
check('범위 밖 기준 거부', badVal.body?.ok === false, JSON.stringify(badVal.body))
const badPin = await call('/api/admin/config', { method: 'POST', body: JSON.stringify({ action: 'prize', staffPin: 'abc' }) }, cookie)
check('숫자 아닌 PIN 거부', badPin.body?.ok === false, JSON.stringify(badPin.body))

console.log('\n[기능] 로그아웃')
const out = await call('/api/admin/login', { method: 'DELETE' }, cookie)
check('로그아웃 응답', out.body?.ok === true, JSON.stringify(out.body))
check('쿠키 만료 지시', /Max-Age=0/i.test(out.setCookie ?? ''), `setCookie=${out.setCookie}`)

console.log(`\n${'─'.repeat(50)}`)
console.log(`통과 ${pass} / 실패 ${fail}`)
process.exit(fail ? 1 : 0)
