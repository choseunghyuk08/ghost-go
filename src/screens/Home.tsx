import { useNavigate } from 'react-router-dom'
import { Btn, Card, Screen, StatPill, XpBar } from '../components/ui'
import { GhostSprite } from '../components/GhostSprite'
import { useGame } from '../store/game'

/**
 * 홈 — 게임의 첫인상.
 * 가장 중요한 행동(유령 찾기)이 화면에서 제일 크고, 나머지는 그 아래.
 */

export function Home() {
  const nav = useNavigate()
  const player = useGame((s) => s.player)
  const dex = useGame((s) => s.dex)
  const totalGhosts = useGame((s) => s.totalGhosts)
  const event = useGame((s) => s.event)
  const prize = useGame((s) => s.prize)

  if (!player) return null

  const found = dex.filter((d) => d.found).length
  const pct = totalGhosts ? Math.round((found / totalGhosts) * 100) : 0
  const recent = dex.filter((d) => d.found).slice(-3).reverse()

  return (
    <Screen withTabBar>
      {/* 상단 상태 바 */}
      <header className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-ghost-white">{player.nickname}</p>
          <p className="text-[11px] text-pumpkin">
            Lv.{player.level} · {player.title}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <StatPill icon="🪙" value={player.coins.toLocaleString()} />
          <StatPill icon="👻" value={`${found}/${totalGhosts}`} />
        </div>
      </header>

      {/* XP 진행도 */}
      <div className="px-4 pt-3">
        <XpBar
          ratio={player.levelProgress.ratio}
          showLabel
          current={player.levelProgress.current}
          needed={player.levelProgress.needed}
        />
      </div>

      {/* 상품 교환권 — 받을 게 있으면 가장 먼저 보이게 */}
      {prize?.enabled && prize.unlocked && !prize.claimed && (
        <button
          onClick={() => nav('/prize')}
          className="tap anim-glow mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pumpkin to-spirit-deep px-4 py-3 text-left active:scale-[0.98]"
        >
          <span className="text-2xl">🎁</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-void">
              {prize.name} 교환권을 받았어요!
            </span>
            <span className="block text-[11px] text-void/75">
              운영 부스에서 이 화면을 보여주세요 · {prize.code}
            </span>
          </span>
          <span className="text-void">›</span>
        </button>
      )}

      {/* 상품까지 남은 개수 */}
      {prize?.enabled && !prize.unlocked && (prize.remaining ?? 0) > 0 && (
        <button
          onClick={() => nav('/prize')}
          className="tap mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-pumpkin/30 bg-pumpkin/5 px-4 py-2.5 text-left active:scale-[0.98]"
        >
          <span className="text-lg">🎁</span>
          <span className="flex-1 text-[12px] text-pumpkin-soft">
            <b className="text-pumpkin">{prize.remaining}마리</b> 더 모으면 {prize.name}!
          </span>
          <span className="text-pumpkin/60">›</span>
        </button>
      )}

      {/* 이벤트 종료/대기 안내 */}
      {event && !event.open && (
        <div className="mx-4 mt-3 rounded-2xl border border-mythic/40 bg-mythic/10 px-4 py-3 text-center text-sm font-bold text-mythic">
          {event.message ?? '지금은 이벤트 시간이 아니에요.'}
        </div>
      )}

      {/* 메인 무대 */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-full bg-spirit/15 blur-3xl" />

        <GhostSprite shape="ribbon" rarity="EPIC" attribute="SHADOW" size={168} aura />

        <p className="mt-4 text-center text-sm leading-relaxed text-lilac">
          {found === 0
            ? '학교 어딘가에 유령이 숨어 있어요.\n벽에 붙은 QR을 찾아보세요!'
            : found >= totalGhosts
              ? '모든 유령을 찾았어요! 당신은 고스트 마스터 👑'
              : `${totalGhosts - found}마리가 아직 숨어 있어요...`}
        </p>

        <Btn
          size="lg"
          className="mt-6 w-full max-w-xs text-xl"
          onClick={() => nav('/scan')}
          disabled={Boolean(event && !event.open)}
        >
          👻 유령 찾기
        </Btn>
      </div>

      {/* 도감 진행 + 최근 발견 */}
      <div className="space-y-3 px-4 pb-4">
        <Card className="p-4" onClick={() => nav('/dex')}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ghost-white">유령 도감</span>
            <span className="tnum text-sm font-black text-pumpkin">{pct}%</span>
          </div>
          <div className="mt-2">
            <XpBar ratio={found / Math.max(1, totalGhosts)} />
          </div>
          {recent.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {recent.map(
                (g) =>
                  g.found && (
                    <div key={g.ghostId} className="flex flex-col items-center">
                      <GhostSprite
                        shape={g.shape}
                        rarity={g.rarity}
                        attribute={g.attribute}
                        size={34}
                        float={false}
                      />
                      <span className="mt-0.5 max-w-[54px] truncate text-[9px] text-muted">
                        {g.name}
                      </span>
                    </div>
                  ),
              )}
              <span className="ml-auto text-[11px] text-muted">최근 발견 →</span>
            </div>
          )}
        </Card>

        {/* 안전 안내 — 학교 행사 필수 */}
        <div className="rounded-2xl border border-pumpkin/25 bg-pumpkin/5 px-4 py-2.5 text-[11px] leading-relaxed text-pumpkin-soft">
          ⚠️ 유령을 찾느라 뛰지 마세요! 계단에서는 스마트폰을 보지 말고,
          다른 사람의 이동을 방해하지 않도록 조심해 주세요.
        </div>
      </div>
    </Screen>
  )
}
