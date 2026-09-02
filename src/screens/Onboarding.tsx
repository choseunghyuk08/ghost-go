import { useEffect, useRef, useState } from 'react'
import { Btn, Card, Screen } from '../components/ui'
import { GhostSprite } from '../components/GhostSprite'
import { checkNickname, isError } from '../lib/api'
import { useGame } from '../store/game'

/**
 * 온보딩 — 고스트 헌터 ID 만들기 (사양 §34)
 * 회원가입 없음. 개인정보 요구 없음. 닉네임 하나로 시작한다.
 */

const EXAMPLES = ['유령사냥꾼', 'Ghost01', '복도의추적자', 'Halloween_1']

type Availability = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'

export function Onboarding() {
  const createPlayer = useGame((s) => s.createPlayer)
  const [nickname, setNickname] = useState('')
  const [avail, setAvail] = useState<Availability>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // 입력이 멈추면 중복 확인 (사양 §34)
  useEffect(() => {
    window.clearTimeout(timer.current)
    const value = nickname.trim()
    if (value.length < 2) {
      setAvail('idle')
      setMessage(null)
      return
    }
    setAvail('checking')
    timer.current = window.setTimeout(async () => {
      const res = await checkNickname(value)
      if (isError(res)) {
        setAvail('idle')
        return
      }
      if (res.available) {
        setAvail('ok')
        setMessage(null)
      } else {
        setAvail(res.message?.includes('사용 중') ? 'taken' : 'invalid')
        setMessage(res.message)
      }
    }, 400)
    return () => window.clearTimeout(timer.current)
  }, [nickname])

  const canSubmit = avail === 'ok' && !submitting

  async function start() {
    if (!canSubmit) return
    setSubmitting(true)
    const res = await createPlayer(nickname.trim())
    if (!res.ok) {
      setMessage(res.message ?? '시작하지 못했어요. 다시 시도해 주세요.')
      setAvail('taken')
      setSubmitting(false)
    }
    // 성공하면 store 의 boot 가 'ready' 로 바뀌며 화면이 전환된다
  }

  return (
    <Screen className="justify-between px-6 pb-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pt-8">
        <div className="text-center">
          <p className="text-sm font-bold tracking-[0.3em] text-pumpkin">HALLOWEEN EVENT</p>
          <h1 className="mt-1 text-5xl font-black tracking-tight text-ghost-white">
            고스트 <span className="text-pumpkin">GO</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-lilac">
            학교 곳곳에 숨어 있는 유령을 찾아
            <br />
            나만의 유령 도감을 완성하라!
          </p>
        </div>

        <div className="flex items-end gap-1">
          <GhostSprite shape="ribbon" rarity="COMMON" attribute="DUST" size={78} aura />
          <GhostSprite shape="clock" rarity="LEGENDARY" attribute="TIME" size={96} aura />
          <GhostSprite shape="drop" rarity="RARE" attribute="WATER" size={72} aura />
        </div>

        <Card className="w-full p-5">
          <label htmlFor="nick" className="block text-sm font-bold text-lilac">
            고스트 헌터 ID를 만들어 주세요
          </label>

          <div className="relative mt-3">
            <input
              id="nick"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="예: 유령사냥꾼"
              className="tap w-full rounded-2xl border-2 border-spirit/35 bg-void/70 px-4 py-3.5 pr-16 text-lg font-bold text-ghost-white placeholder:font-normal placeholder:text-muted focus:border-pumpkin focus:outline-none"
            />
            <span className="tnum absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted">
              {nickname.trim().length}/12
            </span>
          </div>

          <div className="mt-2 min-h-[20px] text-xs">
            {avail === 'checking' && <span className="text-muted">확인 중…</span>}
            {avail === 'ok' && <span className="text-rare">✓ 사용할 수 있는 ID예요!</span>}
            {(avail === 'taken' || avail === 'invalid') && (
              <span className="text-mythic">{message}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setNickname(ex)}
                className="tap rounded-full border border-spirit/30 px-2.5 py-1 text-[11px] text-lilac active:scale-95"
              >
                {ex}
              </button>
            ))}
          </div>

          <p className="mt-4 rounded-xl bg-void/50 p-2.5 text-[11px] leading-relaxed text-muted">
            ※ 실명·학번·전화번호는 절대 입력하지 마세요.
            <br />
            이 게임은 개인정보를 수집하지 않아요.
          </p>
        </Card>
      </div>

      <Btn full size="lg" onClick={start} disabled={!canSubmit} loading={submitting}>
        👻 게임 시작
      </Btn>
    </Screen>
  )
}
