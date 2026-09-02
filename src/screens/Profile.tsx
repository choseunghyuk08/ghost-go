import { useState } from 'react'
import { Btn, Card, Screen, ScreenTitle, XpBar } from '../components/ui'
import { GhostSprite } from '../components/GhostSprite'
import { getSavedNickname } from '../lib/api'
import { useGame } from '../store/game'

/** 프로필 — PHASE 1 범위(레벨·도감·코인). 배지/미션은 PHASE 2에서 추가된다. */
export function Profile() {
  const player = useGame((s) => s.player)
  const dex = useGame((s) => s.dex)
  const totalGhosts = useGame((s) => s.totalGhosts)
  const recoveryCode = useGame((s) => s.recoveryCode)
  const reset = useGame((s) => s.reset)
  const [confirming, setConfirming] = useState(false)

  if (!player) return null
  const found = dex.filter((d) => d.found).length

  return (
    <Screen withTabBar>
      <ScreenTitle title="프로필" />

      <div className="flex flex-col items-center px-5 pt-2">
        <GhostSprite shape="ribbon" rarity="EPIC" attribute="SHADOW" size={104} aura />
        <h2 className="mt-2 text-2xl font-black text-ghost-white">{player.nickname}</h2>
        <p className="text-sm font-bold text-pumpkin">
          Lv.{player.level} · {player.title}
        </p>
      </div>

      <div className="px-5 pt-4">
        <XpBar
          ratio={player.levelProgress.ratio}
          showLabel
          current={player.levelProgress.current}
          needed={player.levelProgress.needed}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
        <Stat icon="📖" label="유령 도감" value={`${found} / ${totalGhosts}`} />
        <Stat icon="👻" label="총 포획" value={`${player.totalCatches}회`} />
        <Stat icon="⚡" label="총 XP" value={player.xp.toLocaleString()} />
        <Stat icon="🪙" label="Ghost Coin" value={player.coins.toLocaleString()} />
      </div>

      {recoveryCode && (
        <Card className="mx-5 mt-4 p-4">
          <p className="text-xs font-bold text-lilac">복구 코드</p>
          <p className="tnum mt-1 text-lg font-black tracking-widest text-pumpkin">{recoveryCode}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            폰을 바꾸거나 브라우저 기록을 지우면 기록이 사라질 수 있어요.
            이 코드를 캡처해 두면 운영자가 복구를 도와줄 수 있어요.
          </p>
        </Card>
      )}

      <Card className="mx-5 mt-3 p-4">
        <p className="text-xs font-bold text-lilac">개인정보 안내</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          이 게임은 실명·학번·전화번호·이메일·위치정보를 <b>수집하지 않아요.</b>
          저장되는 것은 직접 지은 고스트 헌터 ID와 게임 기록뿐이에요.
        </p>
      </Card>

      <div className="px-5 pt-4 pb-6">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-center text-xs text-mythic">
              정말 초기화할까요? 지금까지 모은 유령이 모두 사라져요.
            </p>
            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => setConfirming(false)}>
                취소
              </Btn>
              <Btn variant="danger" full onClick={reset}>
                초기화
              </Btn>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="tap w-full py-2 text-center text-xs text-muted"
          >
            다른 ID로 새로 시작하기
          </button>
        )}
        <p className="pt-2 text-center text-[10px] text-muted">
          저장된 ID: {getSavedNickname() ?? '-'}
        </p>
      </div>
    </Screen>
  )
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <span className="text-[11px] text-muted">{label}</span>
      </div>
      <p className="tnum mt-1 text-xl font-black text-ghost-white">{value}</p>
    </Card>
  )
}
