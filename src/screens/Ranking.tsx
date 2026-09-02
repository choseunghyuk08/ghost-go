import { useCallback, useEffect, useState } from 'react'
import { Card, Screen, ScreenTitle, Spinner } from '../components/ui'
import { fetchRanking, isError, type RankEntry, type RankingResponse } from '../lib/api'

/**
 * 랭킹 (사양 §36·§37·§41·§42)
 *
 * 기본 범위는 '오늘' — 학과체험은 매일 다른 학생이 오므로
 * 3일 누적 순위는 마지막 날 참가자에게 절대 유리하다. "오늘의 1등"이 맞다.
 *
 * 내 순위는 하단에 항상 고정되어 보인다. 하위권 학생이 화면에서 자기를 못 찾으면
 * 바로 이탈한다.
 */

const SORTS = [
  { key: 'xp', label: '전체' },
  { key: 'unique', label: '유령 종류' },
  { key: 'total', label: '포획 수' },
] as const

const MEDAL = ['🥇', '🥈', '🥉']
const PODIUM = [
  'from-[#ffd166]/25 ring-[#ffd166]/60',
  'from-[#cbd5e1]/20 ring-[#cbd5e1]/50',
  'from-[#d68a5c]/20 ring-[#d68a5c]/50',
]

export function Ranking() {
  const [sort, setSort] = useState<string>('xp')
  const [scope, setScope] = useState<'today' | 'all'>('today')
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchRanking(sort, scope)
    if (!isError(res)) setData(res)
    setLoading(false)
  }, [sort, scope])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Screen withTabBar>
      <ScreenTitle
        title="랭킹"
        right={
          <button
            onClick={load}
            className="tap glass rounded-full px-3 py-1.5 text-xs font-bold text-lilac"
          >
            새로고침
          </button>
        }
      />

      {/* 범위 */}
      <div className="flex gap-2 px-5">
        {(['today', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`tap flex-1 rounded-2xl py-2 text-sm font-black transition-colors ${
              scope === s ? 'bg-spirit-deep text-ghost-white' : 'glass text-muted'
            }`}
          >
            {s === 'today' ? '🎃 오늘의 랭킹' : '🏆 전체 명예의 전당'}
          </button>
        ))}
      </div>

      {/* 정렬 필터 */}
      <div className="flex gap-2 px-5 pt-2.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`tap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              sort === s.key ? 'bg-pumpkin text-void' : 'glass text-lilac'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-lilac">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="space-y-2 px-5 pt-4 pb-2">
            {data?.top.map((r) => (
              <RankRow key={`${r.rank}-${r.nickname}`} entry={r} />
            ))}
            {data?.top.length === 0 && (
              <p className="py-10 text-center text-sm text-muted">
                아직 참가자가 없어요. 첫 번째 고스트 헌터가 되어 보세요!
              </p>
            )}
          </div>

          {data && (
            <p className="px-5 pb-2 text-center text-[11px] text-muted">
              {scope === 'today' ? '오늘' : '전체'} 참가자 {data.totalPlayers.toLocaleString()}명
              {data.frozen && ' · 최종 확정된 랭킹이에요'}
            </p>
          )}
        </>
      )}

      {/* 내 순위 — 항상 하단 고정 */}
      {data && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 px-5">
          <div className="mx-auto max-w-md">
            <Card className="border-pumpkin/45 bg-night/95 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pumpkin/20 ring-1 ring-pumpkin/50">
                  <span className="tnum text-sm font-black text-pumpkin">#{data.me.rank}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ghost-white">
                    {data.me.nickname}
                    <span className="ml-1.5 text-[11px] font-normal text-muted">
                      Lv.{data.me.level}
                    </span>
                  </p>
                  <p className="tnum text-[11px] text-lilac">
                    {data.me.uniqueGhosts}종 · {data.me.xp.toLocaleString()} XP
                  </p>
                </div>
              </div>
              {data.me.hint && (
                <p className="mt-2 rounded-lg bg-pumpkin/10 px-2.5 py-1.5 text-center text-[11px] font-bold text-pumpkin-soft">
                  {data.me.hint}
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* 고정 카드에 가려지지 않도록 여백 */}
      <div className="h-28 shrink-0" />
    </Screen>
  )
}

function RankRow({ entry }: { entry: RankEntry }) {
  const podium = entry.rank <= 3
  const idx = entry.rank - 1

  return (
    <div
      className={`glass flex items-center gap-3 rounded-2xl px-3.5 py-3 ${
        podium ? `bg-gradient-to-r to-transparent ring-1 ${PODIUM[idx]}` : ''
      } ${entry.isMe ? 'ring-2 ring-pumpkin/70' : ''}`}
    >
      <div className="w-9 shrink-0 text-center">
        {podium ? (
          <span className="text-2xl">{MEDAL[idx]}</span>
        ) : (
          <span className="tnum text-sm font-black text-muted">{entry.rank}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-ghost-white">
          {entry.nickname}
          {entry.isMe && <span className="ml-1.5 text-[10px] text-pumpkin">나</span>}
        </p>
        <p className="truncate text-[11px] text-muted">
          {podium ? `👑 ${entry.title}` : `Lv.${entry.level} · ${entry.title}`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="tnum text-sm font-black text-pumpkin">{entry.xp.toLocaleString()}</p>
        <p className="tnum text-[11px] text-lilac">{entry.uniqueGhosts} GHOSTS</p>
      </div>
    </div>
  )
}
