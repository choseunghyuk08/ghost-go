import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Btn, Card, RarityTag, Stars } from '../components/ui'
import { GhostSprite } from '../components/GhostSprite'
import { isError, scan, type ApiError, type ScanSuccess } from '../lib/api'
import { useGame } from '../store/game'

/**
 * 발견 연출 — 이 게임의 핵심 경험.
 *
 * 총 4.2초. 이 길이는 근거가 있다:
 *  - 너무 길면 뒤에 줄 선 학생이 밀린다
 *  - 너무 짧으면 "그냥 QR 리더"가 된다
 *
 * 서버 응답은 암전(0~1.7초) 뒤에서 처리한다.
 * 응답이 1.7초 안에 오면 학생은 네트워크 지연을 전혀 느끼지 못한다.
 * 늦어지면 "무언가가 느껴집니다…" 상태로 자연스럽게 대기한다.
 */

type Step = 'blackout' | 'presence' | 'emerge' | 'banner' | 'reward' | 'card' | 'error'

const T = { presence: 600, emerge: 1700, banner: 2700, reward: 3400, card: 4200 }

export function Reveal() {
  const nav = useNavigate()
  const loc = useLocation()
  const navState = loc.state as { slug?: string; idem?: string } | null
  const slug = navState?.slug
  const idem = navState?.idem
  const applyScan = useGame((s) => s.applyScan)

  const [step, setStep] = useState<Step>('blackout')
  const [result, setResult] = useState<ScanSuccess | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const timers = useRef<number[]>([])

  // 슬러그 없이 직접 들어온 경우
  useEffect(() => {
    if (!slug) nav('/scan', { replace: true })
  }, [slug, nav])

  // 서버 호출 — 화면이 뜨자마자 시작한다
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // 연출 시작 시각. effect 안에서 잡아야 렌더가 순수하게 유지된다.
    const startedAt = Date.now()

    ;(async () => {
      const res = await scan(slug, idem)
      if (cancelled) return

      if (isError(res)) {
        setError(res)
        setStep('error')
        return
      }

      setResult(res)
      applyScan(res)

      // 이미 지난 시간을 빼서 총 길이를 4.2초로 유지한다
      const elapsed = Date.now() - startedAt
      const at = (t: number) => Math.max(0, t - elapsed)
      const push = (fn: () => void, delay: number) => {
        timers.current.push(window.setTimeout(fn, delay))
      }

      push(() => setStep('emerge'), at(T.emerge))
      push(() => setStep('banner'), at(T.banner))
      push(() => setStep('reward'), at(T.reward))
      push(() => setStep('card'), at(T.card))

      if ('vibrate' in navigator) {
        window.setTimeout(() => navigator.vibrate?.(res.isNew ? [30, 60, 140] : 25), at(T.emerge))
      }
    })()

    // 암전 → 기척
    timers.current.push(window.setTimeout(() => setStep((s) => (s === 'blackout' ? 'presence' : s)), T.presence))

    return () => {
      cancelled = true
      timers.current.forEach(window.clearTimeout)
      timers.current = []
    }
  }, [slug, idem, applyScan])

  /** 연출 건너뛰기 */
  function skip() {
    if (!result) return
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setStep('card')
  }

  /* ------------------------------------------------------------------ 에러 */

  if (step === 'error' && error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-void px-6">
        <div className="text-5xl opacity-60">🌫️</div>
        <p className="text-center text-lg font-bold text-ghost-white">{error.message}</p>
        <div className="w-full max-w-xs space-y-2 pt-2">
          <Btn full onClick={() => nav('/scan', { replace: true })}>
            다시 스캔하기
          </Btn>
          <Btn variant="ghost" full onClick={() => nav('/', { replace: true })}>
            홈으로
          </Btn>
        </div>
      </div>
    )
  }

  const g = result?.ghost
  const showGhost = step === 'emerge' || step === 'banner' || step === 'reward' || step === 'card'

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-void px-6 ${
        step === 'blackout' ? 'anim-shake' : ''
      }`}
      onClick={skip}
    >
      {/* 안개 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="anim-fog absolute -inset-x-1/3 top-1/3 h-2/3 rounded-full blur-3xl transition-opacity duration-700"
          style={{
            opacity: step === 'blackout' ? 0.15 : 0.5,
            background: `radial-gradient(ellipse at center, ${
              g ? RARITY_GLOW[g.rarity] : '#7b2cbf'
            } 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* 등장 플래시 */}
      {step === 'emerge' && (
        <div className="anim-flash pointer-events-none absolute inset-0 z-20 bg-white" aria-hidden />
      )}

      {/* 기척 */}
      {(step === 'blackout' || step === 'presence') && (
        <p className="anim-rise z-10 text-center text-lg font-bold tracking-wide text-lilac">
          {step === 'blackout' ? '' : '무언가가 느껴집니다…'}
        </p>
      )}

      {/* 유령 */}
      {showGhost && g && (
        <div className="anim-pop z-10 flex flex-col items-center">
          <GhostSprite shape={g.shape} rarity={g.rarity} attribute={g.attribute} size={200} aura />
        </div>
      )}

      {/* 배너 */}
      {(step === 'banner' || step === 'reward' || step === 'card') && result && (
        <div className="anim-rise z-10 mt-4 text-center">
          {result.isNew ? (
            <p className="text-3xl font-black tracking-tight text-pumpkin drop-shadow-[0_0_18px_#ff7a00]">
              ✨ NEW GHOST!
            </p>
          ) : (
            <p className="text-xl font-bold text-lilac">이미 발견한 유령이에요</p>
          )}
          <p className="mt-1 text-2xl font-black text-ghost-white">{g?.name}</p>
        </div>
      )}

      {/* 보상 */}
      {(step === 'reward' || step === 'card') && result && (
        <div className="anim-rise z-10 mt-3 flex gap-3">
          {result.xpGained > 0 && (
            <span className="tnum rounded-full bg-spirit-deep/80 px-4 py-1.5 text-lg font-black text-ghost-white">
              +{result.xpGained} XP
            </span>
          )}
          {result.coinGained > 0 && (
            <span className="tnum rounded-full bg-pumpkin/85 px-4 py-1.5 text-lg font-black text-void">
              +{result.coinGained} 🪙
            </span>
          )}
          {!result.rewarded && !result.isNew && (
            <span className="rounded-full bg-void/70 px-4 py-1.5 text-sm text-muted ring-1 ring-spirit/25">
              조금 뒤에 다시 오면 보상을 받아요
            </span>
          )}
        </div>
      )}

      {/* 최종 카드 */}
      {step === 'card' && result && g && (
        <div className="anim-rise z-10 mt-5 w-full max-w-sm">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="tnum text-xs font-bold text-muted">No.{String(g.no).padStart(2, '0')}</span>
              <RarityTag rarity={g.rarity} />
            </div>
            <Stars rarity={g.rarity} />
            <p className="mt-2 text-sm leading-relaxed text-lilac">{g.desc}</p>
            {result.duplicateLine && (
              <p className="mt-2 text-xs text-muted italic">{result.duplicateLine}</p>
            )}

            {result.leveledUp && (
              <div className="anim-pop mt-3 rounded-xl bg-gradient-to-r from-spirit-deep to-pumpkin px-4 py-2.5 text-center">
                <p className="text-sm font-black text-ghost-white">
                  🎉 LEVEL UP! Lv.{result.levelBefore} → Lv.{result.levelAfter}
                </p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="도감" value={`${result.uniqueGhosts}/${result.totalGhosts}`} />
              <Stat label="총 XP" value={result.totalXp.toLocaleString()} />
              <Stat
                label="순위"
                value={`#${result.rank}`}
                highlight={result.rankUp}
                sub={result.rankUp ? `▲${result.rankBefore - result.rank}` : undefined}
              />
            </div>
          </Card>

          <div className="mt-3 space-y-2">
            <Btn full size="lg" onClick={() => nav('/scan', { replace: true })}>
              👻 다음 유령 찾기
            </Btn>
            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => nav('/dex', { replace: true })}>
                도감 보기
              </Btn>
              <Btn variant="ghost" full onClick={() => nav('/', { replace: true })}>
                홈으로
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* 건너뛰기 힌트 */}
      {step !== 'card' && step !== 'error' && result && (
        <p className="absolute bottom-8 z-10 text-[11px] text-muted">화면을 누르면 건너뛰어요</p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl bg-void/50 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`tnum text-sm font-black ${highlight ? 'text-pumpkin' : 'text-ghost-white'}`}>
        {value}
        {sub && <span className="ml-0.5 text-[10px] text-rare">{sub}</span>}
      </p>
    </div>
  )
}

const RARITY_GLOW: Record<string, string> = {
  COMMON: '#9aa5b1',
  RARE: '#4cc9f0',
  EPIC: '#9d4edd',
  LEGENDARY: '#ff7a00',
  MYTHIC: '#ff3d81',
}
