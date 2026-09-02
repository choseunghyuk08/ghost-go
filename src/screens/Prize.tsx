import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Card, Screen, ScreenTitle } from '../components/ui'
import { GhostSprite } from '../components/GhostSprite'
import { claimPrize, isError } from '../lib/api'
import { useGame } from '../store/game'

/**
 * 상품 교환권
 *
 * 부스에서 학생이 이 화면을 보여주면, 스태프가 이 폰에서 PIN 을 눌러 수령을 확정한다.
 * 확정되면 서버에 시각이 기록되어 새로고침해도 되돌아가지 않는다 — 중복 수령 차단.
 */

export function Prize() {
  const nav = useNavigate()
  const prize = useGame((s) => s.prize)
  const player = useGame((s) => s.player)
  const refresh = useGame((s) => s.refresh)

  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staffMode, setStaffMode] = useState(false)

  if (!prize || !prize.enabled || !player) {
    return (
      <Screen withTabBar>
        <ScreenTitle title="상품" />
        <p className="px-5 text-sm text-muted">지금은 상품 지급 기간이 아니에요.</p>
      </Screen>
    )
  }

  const threshold = prize.threshold ?? 4
  const remaining = prize.remaining ?? Math.max(0, threshold - player.uniqueGhosts)

  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await claimPrize(pin)
    if (isError(res)) {
      setError(res.message)
      setPin('')
    } else {
      await refresh()
      setStaffMode(false)
    }
    setBusy(false)
  }

  /* ---------------------------------------------------------- 수령 완료 */
  if (prize.claimed) {
    const when = prize.claimedAt
      ? new Date(prize.claimedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : ''
    return (
      <Screen withTabBar>
        <ScreenTitle title="상품" />
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="text-6xl">✅</div>
          <h2 className="mt-3 text-2xl font-black text-ghost-white">수령 완료</h2>
          <p className="mt-1 text-sm text-lilac">
            {prize.name} 받아 갔어요 {when && `· ${when}`}
          </p>
          <Card className="mt-5 w-full max-w-xs p-4 text-center opacity-60">
            <p className="text-[11px] text-muted">교환권 번호</p>
            <p className="tnum mt-1 text-2xl font-black tracking-[0.2em] text-muted line-through">
              {prize.code}
            </p>
          </Card>
          <p className="mt-4 text-center text-xs text-muted">
            이 교환권은 이미 사용되었어요.
            <br />
            남은 유령을 계속 찾아보세요!
          </p>
          <Btn className="mt-5" onClick={() => nav('/scan')}>
            👻 유령 찾으러 가기
          </Btn>
        </div>
      </Screen>
    )
  }

  /* ---------------------------------------------------------- 아직 미달성 */
  if (!prize.unlocked) {
    return (
      <Screen withTabBar>
        <ScreenTitle title="상품" />
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="text-6xl opacity-50">🎁</div>
          <h2 className="mt-3 text-center text-xl font-black text-ghost-white">
            유령 {threshold}마리를 모으면
            <br />
            {prize.name}를 드려요!
          </h2>

          <div className="mt-5 flex gap-2">
            {Array.from({ length: threshold }, (_, i) => (
              <div
                key={i}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
                  i < player.uniqueGhosts
                    ? 'bg-pumpkin text-void'
                    : 'glass text-muted'
                }`}
              >
                {i < player.uniqueGhosts ? '👻' : '?'}
              </div>
            ))}
          </div>

          <p className="tnum mt-4 text-sm text-lilac">
            {player.uniqueGhosts} / {threshold} 마리
          </p>
          <p className="mt-1 text-lg font-black text-pumpkin">{remaining}마리 남았어요!</p>

          <Btn size="lg" className="mt-6" onClick={() => nav('/scan')}>
            👻 유령 찾으러 가기
          </Btn>
        </div>
      </Screen>
    )
  }

  /* ---------------------------------------------------------- 교환권 */
  return (
    <Screen withTabBar>
      <ScreenTitle title="상품 교환권" />
      <div className="flex flex-1 flex-col items-center px-6 pt-2">
        <Card className="w-full max-w-sm border-pumpkin/50 p-6 text-center">
          <div className="anim-float text-5xl">🎁</div>
          <p className="mt-2 text-sm font-bold text-pumpkin">상품 교환권</p>
          <h2 className="mt-1 text-3xl font-black text-ghost-white">{prize.name}</h2>

          <div className="mt-4 rounded-2xl bg-void/60 py-4 ring-1 ring-pumpkin/30">
            <p className="text-[11px] text-muted">교환권 번호</p>
            <p className="tnum mt-1 text-4xl font-black tracking-[0.25em] text-pumpkin">
              {prize.code}
            </p>
          </div>

          <p className="mt-3 truncate text-sm font-bold text-ghost-white">{player.nickname}</p>
          <p className="text-[11px] text-muted">유령 {player.uniqueGhosts}마리 발견</p>

          <div className="mt-4 rounded-xl bg-pumpkin/10 px-3 py-2.5 text-[11px] leading-relaxed text-pumpkin-soft">
            이 화면을 <b>운영 부스 스태프</b>에게 보여주세요.
            <br />
            스태프가 확인을 눌러야 수령이 완료됩니다.
          </div>
        </Card>

        {/* 스태프 확인 */}
        {!staffMode ? (
          <button
            onClick={() => setStaffMode(true)}
            className="tap mt-5 rounded-xl border border-spirit/30 px-4 py-2.5 text-xs text-lilac active:scale-95"
          >
            🧑‍💼 스태프 확인
          </button>
        ) : (
          <Card className="mt-5 w-full max-w-sm p-5">
            <p className="text-sm font-bold text-ghost-white">스태프 확인</p>
            <p className="mt-1 text-[11px] text-muted">
              PIN을 입력하면 수령이 확정되고 되돌릴 수 없어요.
            </p>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN"
              className="tnum tap mt-3 w-full rounded-xl border-2 border-spirit/35 bg-void/70 px-4 py-3 text-center text-2xl font-black tracking-[0.3em] text-ghost-white placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-pumpkin focus:outline-none"
            />
            {error && <p className="mt-2 text-center text-xs text-mythic">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Btn variant="ghost" full onClick={() => { setStaffMode(false); setPin(''); setError(null) }}>
                취소
              </Btn>
              <Btn full loading={busy} disabled={pin.length < 4} onClick={confirm}>
                수령 확인
              </Btn>
            </div>
          </Card>
        )}

        <div className="mt-6 opacity-40">
          <GhostSprite shape="ribbon" rarity="LEGENDARY" attribute="LIGHT" size={72} />
        </div>
      </div>
    </Screen>
  )
}
