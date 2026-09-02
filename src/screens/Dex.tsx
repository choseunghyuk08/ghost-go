import { useState } from 'react'
import { Card, RarityTag, Screen, ScreenTitle, Stars, XpBar } from '../components/ui'
import { GhostSprite, GhostSilhouette } from '../components/GhostSprite'
import { ATTRIBUTE_LABEL } from '../data/ghosts'
import type { DexEntry, DexFound } from '../lib/api'
import { useGame } from '../store/game'

/**
 * 유령 도감.
 * 미발견 칸은 검은 실루엣 + ? 로 남겨 "저건 뭘까"를 만든다.
 * 서버가 미발견 유령의 이름·설명을 아예 내려주지 않으므로 스포일러가 원천 차단된다.
 */

const FLOORS = [0, 1, 2, 3] as const
const FLOOR_LABEL: Record<number, string> = { 0: '전체', 1: '1층', 2: '2층', 3: '3층' }

export function Dex() {
  const dex = useGame((s) => s.dex)
  const totalGhosts = useGame((s) => s.totalGhosts)
  const [floor, setFloor] = useState<number>(0)
  const [selected, setSelected] = useState<DexFound | null>(null)

  const found = dex.filter((d) => d.found).length
  const pct = totalGhosts ? Math.round((found / totalGhosts) * 100) : 0

  // 미발견은 층을 모르므로 층 필터에서는 전체에만 노출한다
  const visible = dex.filter((d) => floor === 0 || (d.found && d.floor === floor))

  return (
    <Screen withTabBar>
      <ScreenTitle
        title="유령 도감"
        right={
          <span className="tnum text-sm font-black text-pumpkin">
            {found}/{totalGhosts}
          </span>
        }
      />

      <div className="px-5">
        <XpBar ratio={found / Math.max(1, totalGhosts)} />
        <p className="mt-1 text-right text-[11px] text-muted">도감 완성률 {pct}%</p>
      </div>

      {/* 층 필터 */}
      <div className="flex gap-2 px-5 pt-3">
        {FLOORS.map((f) => (
          <button
            key={f}
            onClick={() => setFloor(f)}
            className={`tap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              floor === f ? 'bg-pumpkin text-void' : 'glass text-lilac'
            }`}
          >
            {FLOOR_LABEL[f]}
          </button>
        ))}
      </div>

      {/* 그리드 */}
      <div className="grid grid-cols-3 gap-2.5 px-5 pt-4">
        {visible.map((entry) => (
          <DexCell key={entry.ghostId} entry={entry} onOpen={setSelected} />
        ))}
      </div>

      {visible.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-muted">
          이 층에서 발견한 유령이 아직 없어요.
        </p>
      )}

      {selected && <DetailSheet ghost={selected} onClose={() => setSelected(null)} />}
    </Screen>
  )
}

function DexCell({ entry, onOpen }: { entry: DexEntry; onOpen: (g: DexFound) => void }) {
  if (!entry.found) {
    return (
      <div className="glass flex aspect-[3/4] flex-col items-center justify-center rounded-2xl opacity-60">
        <GhostSilhouette size={52} />
        <span className="tnum mt-1 text-[10px] text-muted">
          No.{String(entry.no).padStart(2, '0')}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={() => onOpen(entry)}
      className="glass tap flex aspect-[3/4] flex-col items-center justify-center rounded-2xl px-1 transition-transform active:scale-95"
    >
      <GhostSprite
        shape={entry.shape}
        rarity={entry.rarity}
        attribute={entry.attribute}
        size={52}
        float={false}
      />
      <span className="mt-1 max-w-full truncate px-1 text-[11px] font-bold text-ghost-white">
        {entry.name}
      </span>
      <Stars rarity={entry.rarity} size="sm" />
      {entry.count > 1 && (
        <span className="tnum mt-0.5 text-[9px] text-muted">{entry.count}회 발견</span>
      )}
    </button>
  )
}

function DetailSheet({ ghost, onClose }: { ghost: DexFound; onClose: () => void }) {
  const date = new Date(ghost.firstAt).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="anim-rise safe-b w-full max-w-md rounded-t-[28px] border-t border-spirit/35 bg-night px-6 pt-3 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-spirit/40" />

        <div className="flex flex-col items-center">
          <GhostSprite
            shape={ghost.shape}
            rarity={ghost.rarity}
            attribute={ghost.attribute}
            size={128}
            aura
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="tnum text-xs text-muted">No.{String(ghost.no).padStart(2, '0')}</span>
            <RarityTag rarity={ghost.rarity} />
          </div>
          <h2 className="mt-1 text-2xl font-black text-ghost-white">{ghost.name}</h2>
          <Stars rarity={ghost.rarity} />
        </div>

        <Card className="mt-4 p-4">
          <p className="text-sm leading-relaxed text-lilac">{ghost.desc}</p>
        </Card>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Info label="속성" value={ATTRIBUTE_LABEL[ghost.attribute] ?? ghost.attribute} />
          <Info label="출몰 층" value={`${ghost.floor}층`} />
          <Info label="발견 횟수" value={`${ghost.count}회`} />
        </div>

        <p className="mt-3 text-center text-[11px] text-muted">최초 발견 · {date}</p>

        <button
          onClick={onClose}
          className="tap mt-4 w-full rounded-2xl border border-spirit/30 py-3 text-sm font-bold text-lilac active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl py-2.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-bold text-ghost-white">{value}</p>
    </div>
  )
}
