import { useCallback, useEffect, useState } from 'react'
import { Btn, Card, Screen, Spinner } from '../components/ui'

/**
 * 운영 화면 (/ops)
 *
 * 경로를 숨기는 것은 보안이 아니다. 실제 방어는 서버에 있다 —
 * 이 화면은 로그인 전에는 아무 데이터도 받지 못하는 빈 껍데기다.
 *
 * 행사 중 스태프가 폰으로 새로고침하며 보는 화면이라
 * 한 화면에 필요한 것만 크게 배치한다.
 */

type Tab = '요약' | '상품' | '참가자' | 'QR' | '설정'

interface Data {
  now: number
  config: {
    status: string
    prizeEnabled: boolean
    prizeThreshold: number
    prizeName: string
    staffPin: string
    scanCooldownSec: number
    sameGhostCooldownSec: number
    maxScansPerMin: number
  }
  stats: {
    players: number
    today_players: number
    scans: number
    today_scans: number
    discoveries: number
    prize_unlocked: number
    prize_claimed: number
    today_claimed: number
    recentClaims10min: number
  }
  ghosts: Array<{ ghost_id: string; no: number; name: string; rarity: string; floor: number; finders: number; scans: number }>
  codes: Array<{ slug: string; name: string; placement: string | null; is_active: number; scan_count: number }>
  players: Array<{
    id: string; nickname: string; level: number; xp: number; unique_ghosts: number
    total_catches: number; created_at: number; last_active_at: number
    prize_unlocked_at: number | null; prize_claimed_at: number | null; prize_code: string | null
    is_blocked: number
  }>
  claims: Array<{ nickname: string; prize_code: string | null; unique_ghosts: number; claimed_at: number }>
  recent: Array<{ nickname: string | null; slug: string | null; name: string | null; is_new: number; result: string; created_at: number }>
}

const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

const ago = (t: number, now: number) => {
  const m = Math.floor((now - t) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  return `${Math.floor(m / 60)}시간 전`
}

export function Ops() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<Tab>('요약')

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/data')
    if (r.status === 401) { setAuthed(false); return }
    const j = await r.json()
    if (j.ok) { setData(j); setAuthed(true) }
    else setErr(j.message ?? '불러오지 못했습니다.')
  }, [])

  useEffect(() => { void load() }, [load])

  // 행사 중에는 자동 갱신
  useEffect(() => {
    if (!authed) return
    const id = setInterval(() => void load(), 30_000)
    return () => clearInterval(id)
  }, [authed, load])

  async function login() {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    const j = await r.json()
    if (j.ok) { setPw(''); await load() } else setErr(j.message ?? '로그인 실패')
    setBusy(false)
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    const r = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!j.ok) setErr(j.message ?? '변경 실패')
    else setErr(null)
    await load()
    setBusy(false)
  }

  /* ------------------------------------------------------------- 로그인 */
  if (authed === null) {
    return <Screen className="items-center justify-center"><Spinner /></Screen>
  }

  if (!authed) {
    return (
      <Screen className="items-center justify-center px-6">
        <Card className="w-full max-w-xs p-6">
          <p className="text-center text-2xl">🔒</p>
          <h1 className="mt-2 text-center text-lg font-black text-ghost-white">고스트 GO 운영</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="비밀번호"
            className="tap mt-4 w-full rounded-xl border-2 border-spirit/35 bg-void/70 px-4 py-3 text-center text-ghost-white placeholder:text-muted focus:border-pumpkin focus:outline-none"
          />
          {err && <p className="mt-2 text-center text-xs text-mythic">{err}</p>}
          <Btn full className="mt-3" loading={busy} onClick={login}>로그인</Btn>
        </Card>
      </Screen>
    )
  }

  if (!data) return <Screen className="items-center justify-center"><Spinner /></Screen>

  const s = data.stats
  const c = data.config

  return (
    <Screen fog={false} className="pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-lg font-black text-ghost-white">🎃 운영</h1>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            c.status === 'running' ? 'bg-rare/20 text-rare'
            : c.status === 'ended' ? 'bg-mythic/20 text-mythic' : 'bg-muted/20 text-muted'
          }`}>
            {c.status === 'running' ? '🟢 진행 중' : c.status === 'ended' ? '🔴 종료' : '⚪ 시작 전'}
          </span>
          <button onClick={load} className="tap glass rounded-full px-3 py-1 text-[11px] text-lilac">
            새로고침
          </button>
        </div>
      </div>

      {err && <p className="mx-4 mt-2 rounded-lg bg-mythic/15 px-3 py-2 text-xs text-mythic">{err}</p>}

      {/* 탭 */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {(['요약', '상품', '참가자', 'QR', '설정'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tap shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
              tab === t ? 'bg-pumpkin text-void' : 'glass text-lilac'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {/* ------------------------------------------------------ 요약 */}
        {tab === '요약' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="오늘 참가자" value={s.today_players} sub={`누적 ${s.players}`} />
              <Stat label="오늘 스캔" value={s.today_scans} sub={`누적 ${s.scans}`} />
              <Stat label="오늘 수령" value={s.today_claimed} sub={`누적 ${s.prize_claimed}`} accent />
              <Stat label="교환권 발급" value={s.prize_unlocked} sub={`미수령 ${s.prize_unlocked - s.prize_claimed}`} />
            </div>

            {s.recentClaims10min >= 8 && (
              <div className="rounded-xl border border-mythic/40 bg-mythic/10 px-3 py-2.5 text-xs text-mythic">
                ⚠️ 최근 10분간 수령 <b>{s.recentClaims10min}건</b> — 평소보다 많습니다.
                손등 스탬프 확인을 권합니다.
              </div>
            )}

            <Card className="p-3">
              <p className="text-xs font-bold text-lilac">최근 스캔</p>
              <div className="mt-2 space-y-1">
                {data.recent.slice(0, 12).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-10 shrink-0 text-muted">{hhmm(r.created_at)}</span>
                    <span className="w-20 shrink-0 truncate text-ghost-white">{r.nickname ?? '-'}</span>
                    <span className="flex-1 truncate text-lilac">{r.name ?? r.slug ?? '-'}</span>
                    <span className={r.result === 'ok' ? (r.is_new ? 'text-pumpkin' : 'text-muted') : 'text-mythic'}>
                      {r.result === 'ok' ? (r.is_new ? 'NEW' : '중복') : r.result}
                    </span>
                  </div>
                ))}
                {!data.recent.length && <p className="text-[11px] text-muted">아직 스캔이 없습니다.</p>}
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------------------------------ 상품 */}
        {tab === '상품' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="발급" value={s.prize_unlocked} />
              <Stat label="수령" value={s.prize_claimed} accent />
              <Stat label="미수령" value={s.prize_unlocked - s.prize_claimed} />
            </div>

            <Card className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-lilac">수령 이력</p>
                <p className="text-[11px] text-muted">오늘 {s.today_claimed}건</p>
              </div>
              <div className="mt-2 space-y-1">
                {data.claims.map((cl, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-10 shrink-0 text-muted">{hhmm(cl.claimed_at)}</span>
                    <span className="flex-1 truncate font-bold text-ghost-white">{cl.nickname}</span>
                    <span className="tnum w-12 shrink-0 text-pumpkin">{cl.prize_code}</span>
                    <span className="w-10 shrink-0 text-right text-lilac">{cl.unique_ghosts}종</span>
                  </div>
                ))}
                {!data.claims.length && <p className="text-[11px] text-muted">아직 수령이 없습니다.</p>}
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------------------------------ 참가자 */}
        {tab === '참가자' && (
          <Card className="p-3">
            <p className="text-xs font-bold text-lilac">최근 활동순 (최대 100명)</p>
            <div className="mt-2 space-y-1">
              {data.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 shrink-0 truncate font-bold text-ghost-white">{p.nickname}</span>
                  <span className="w-8 shrink-0 text-muted">L{p.level}</span>
                  <span className="w-10 shrink-0 text-lilac">{p.unique_ghosts}종</span>
                  <span className="w-12 shrink-0 text-muted">{ago(p.last_active_at, data.now)}</span>
                  <span className="flex-1 text-right">
                    {p.prize_claimed_at ? <span className="text-rare">수령</span>
                      : p.prize_unlocked_at ? <span className="text-pumpkin">발급</span>
                      : <span className="text-muted">-</span>}
                  </span>
                  <button
                    onClick={() => post({ action: 'player', playerId: p.id, blocked: !p.is_blocked })}
                    className={`tap shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                      p.is_blocked ? 'bg-mythic/25 text-mythic' : 'text-muted'
                    }`}
                  >
                    {p.is_blocked ? '차단됨' : '차단'}
                  </button>
                </div>
              ))}
              {!data.players.length && <p className="text-[11px] text-muted">참가자가 없습니다.</p>}
            </div>
          </Card>
        )}

        {/* ------------------------------------------------------ QR */}
        {tab === 'QR' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-pumpkin/30 bg-pumpkin/5 px-3 py-2 text-[11px] text-pumpkin-soft">
              스캔 0회인 QR 은 <b>부착 위치가 안 보이거나 인쇄가 흐릴</b> 가능성이 큽니다. 확인해 주세요.
            </div>
            <Card className="p-3">
              <div className="space-y-1">
                {data.codes.map((cd) => (
                  <div key={cd.slug} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 shrink-0 truncate font-bold text-ghost-white">{cd.name}</span>
                    <span className={`tnum w-8 shrink-0 text-right ${cd.scan_count === 0 ? 'text-mythic' : 'text-lilac'}`}>
                      {cd.scan_count}
                    </span>
                    <span className="flex-1 truncate text-muted">{cd.placement ?? '-'}</span>
                    <button
                      onClick={() => post({ action: 'code', slug: cd.slug, active: !cd.is_active })}
                      className={`tap shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                        cd.is_active ? 'bg-rare/20 text-rare' : 'bg-mythic/25 text-mythic'
                      }`}
                    >
                      {cd.is_active ? 'ON' : 'OFF'}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-3">
              <p className="text-xs font-bold text-lilac">유령별 발견 인원</p>
              <div className="mt-2 space-y-1">
                {data.ghosts.map((g) => (
                  <div key={g.ghost_id} className="flex items-center gap-2 text-[11px]">
                    <span className="w-5 shrink-0 text-muted">{g.no}</span>
                    <span className="w-20 shrink-0 truncate text-ghost-white">{g.name}</span>
                    <span className="w-10 shrink-0 text-muted">{g.floor}층</span>
                    <span className="flex-1 text-right text-pumpkin">{g.finders}명</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------------------------------ 설정 */}
        {tab === '설정' && (
          <div className="space-y-3">
            <Card className="p-4">
              <p className="text-xs font-bold text-lilac">이벤트 상태</p>
              <div className="mt-2 flex gap-2">
                {[['before', '시작 전'], ['running', '진행 중'], ['ended', '종료']].map(([v, l]) => (
                  <Btn
                    key={v}
                    size="sm"
                    variant={c.status === v ? 'primary' : 'ghost'}
                    onClick={() => post({ action: 'event', status: v })}
                    disabled={busy}
                  >
                    {l}
                  </Btn>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                종료로 바꾸면 스캔해도 보상이 지급되지 않습니다.
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-lilac">상품</p>
                <Btn
                  size="sm"
                  variant={c.prizeEnabled ? 'primary' : 'ghost'}
                  onClick={() => post({ action: 'prize', prizeEnabled: !c.prizeEnabled })}
                  disabled={busy}
                >
                  {c.prizeEnabled ? '지급 중' : '중단됨'}
                </Btn>
              </div>

              <Field label={`기준 (현재 ${c.prizeThreshold}마리)`}>
                <div className="flex gap-1.5">
                  {[3, 4, 5, 6, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => post({ action: 'prize', prizeThreshold: n })}
                      className={`tap flex-1 rounded-lg py-2 text-xs font-bold ${
                        c.prizeThreshold === n ? 'bg-pumpkin text-void' : 'glass text-lilac'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>

              <EditRow label="상품명" value={c.prizeName} onSave={(v) => post({ action: 'prize', prizeName: v })} />
              <EditRow label="스태프 PIN" value={c.staffPin} onSave={(v) => post({ action: 'prize', staffPin: v })} />
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold text-lilac">스캔 규칙</p>
              <EditRow label="전역 쿨다운(초)" value={String(c.scanCooldownSec)} onSave={(v) => post({ action: 'rules', scanCooldownSec: Number(v) })} />
              <EditRow label="같은 유령 쿨다운(초)" value={String(c.sameGhostCooldownSec)} onSave={(v) => post({ action: 'rules', sameGhostCooldownSec: Number(v) })} />
              <EditRow label="분당 최대 스캔" value={String(c.maxScansPerMin)} onSave={(v) => post({ action: 'rules', maxScansPerMin: Number(v) })} />
            </Card>

            <button
              onClick={async () => { await fetch('/api/admin/login', { method: 'DELETE' }); setAuthed(false) }}
              className="tap w-full py-3 text-center text-xs text-muted"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </Screen>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`tnum text-2xl font-black ${accent ? 'text-pumpkin' : 'text-ghost-white'}`}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] text-muted">{label}</p>
      {children}
    </div>
  )
}

function EditRow({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const dirty = v !== value
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] text-muted">{label}</p>
      <div className="flex gap-1.5">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="tap min-w-0 flex-1 rounded-lg border border-spirit/35 bg-void/70 px-3 py-2 text-sm text-ghost-white focus:border-pumpkin focus:outline-none"
        />
        <Btn size="sm" disabled={!dirty} onClick={() => onSave(v)}>저장</Btn>
      </div>
    </div>
  )
}
