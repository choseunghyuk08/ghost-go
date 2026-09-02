import type { ReactNode, ButtonHTMLAttributes } from 'react'
import type { Rarity } from '../types'

/**
 * 공용 UI 프리미티브.
 * 모든 화면은 여기 있는 것만 조합해서 만든다 (톤이 어긋나지 않도록).
 * 애니메이션은 transform/opacity 만 사용한다 — 저사양 안드로이드에서 프레임이 떨어지지 않게.
 */

/* --------------------------------------------------------------- 등급 --- */

export const RARITY_META: Record<Rarity, { label: string; stars: number; text: string; ring: string; glow: string }> = {
  COMMON: { label: 'Common', stars: 2, text: 'text-common', ring: 'ring-common/40', glow: 'shadow-[0_0_24px_-6px_#9aa5b1]' },
  RARE: { label: 'Rare', stars: 3, text: 'text-rare', ring: 'ring-rare/50', glow: 'shadow-[0_0_28px_-4px_#4cc9f0]' },
  EPIC: { label: 'Epic', stars: 4, text: 'text-epic', ring: 'ring-epic/60', glow: 'shadow-[0_0_32px_-4px_#9d4edd]' },
  LEGENDARY: { label: 'Legendary', stars: 5, text: 'text-legendary', ring: 'ring-legendary/70', glow: 'shadow-[0_0_38px_-2px_#ff7a00]' },
  MYTHIC: { label: 'Mythic', stars: 6, text: 'text-mythic', ring: 'ring-mythic/80', glow: 'shadow-[0_0_44px_0_#ff3d81]' },
}

export function Stars({ rarity, size = 'md' }: { rarity: Rarity; size?: 'sm' | 'md' }) {
  const meta = RARITY_META[rarity]
  const cls = size === 'sm' ? 'text-[10px]' : 'text-xs'
  return (
    <span className={`${meta.text} ${cls} tracking-tight`} aria-label={`${meta.label} 등급`}>
      {'★'.repeat(meta.stars)}
      <span className="text-muted">{'☆'.repeat(6 - meta.stars)}</span>
    </span>
  )
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity]
  return (
    <span
      className={`${meta.text} rounded-full border border-current/30 bg-current/10 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase`}
    >
      {meta.label}
    </span>
  )
}

/* --------------------------------------------------------------- 버튼 --- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'lg' | 'md' | 'sm'
  full?: boolean
  loading?: boolean
  children: ReactNode
}

export function Btn({
  variant = 'primary',
  size = 'md',
  full,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: BtnProps) {
  const base =
    'tap relative inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-transform duration-100 select-none active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100'
  const sizes = {
    lg: 'px-7 py-4 text-lg',
    md: 'px-5 py-3 text-base',
    sm: 'px-3.5 py-2 text-sm',
  }[size]
  const variants = {
    primary:
      'bg-pumpkin text-void shadow-[0_6px_0_0_#b45400,0_10px_28px_-8px_#ff7a00] active:shadow-[0_2px_0_0_#b45400] active:translate-y-1',
    secondary:
      'bg-spirit-deep text-ghost-white shadow-[0_6px_0_0_#4c1d80,0_10px_28px_-10px_#9d4edd] active:shadow-[0_2px_0_0_#4c1d80] active:translate-y-1',
    ghost: 'glass text-lilac',
    danger: 'bg-mythic/85 text-void shadow-[0_6px_0_0_#a8194f] active:translate-y-1',
  }[variant]

  return (
    <button
      className={`${base} ${sizes} ${variants} ${full ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
      role="status"
      aria-label="불러오는 중"
    />
  )
}

/* --------------------------------------------------------------- 카드 --- */

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`glass rounded-[20px] ${onClick ? 'tap text-left transition-transform active:scale-[0.98]' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------- 진행도 --- */

export function XpBar({ ratio, showLabel, current, needed }: {
  ratio: number
  showLabel?: boolean
  current?: number
  needed?: number
}) {
  return (
    <div className="w-full">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-void/70 ring-1 ring-spirit/25">
        <div
          className="h-full rounded-full bg-gradient-to-r from-spirit to-pumpkin transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(3, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      {showLabel && needed !== undefined && (
        <div className="tnum mt-1 text-right text-[11px] text-muted">
          {current?.toLocaleString()} / {needed.toLocaleString()} XP
        </div>
      )}
    </div>
  )
}

export function StatPill({ icon, value, label }: { icon: string; value: ReactNode; label?: string }) {
  return (
    <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
      <span aria-hidden>{icon}</span>
      <span className="tnum text-sm font-bold text-ghost-white">{value}</span>
      {label && <span className="text-[11px] text-muted">{label}</span>}
    </div>
  )
}

/* --------------------------------------------------------------- 배경 --- */

/** 안개 레이어 — 화면 뒤에 깔아 할로윈 분위기를 만든다 */
export function FogLayer({ intensity = 1 }: { intensity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="anim-fog absolute -inset-x-1/4 top-1/4 h-1/2 rounded-full blur-3xl"
        style={{
          opacity: 0.35 * intensity,
          background: 'radial-gradient(ellipse at center, #7b2cbf 0%, transparent 70%)',
        }}
      />
      <div
        className="anim-fog absolute -inset-x-1/4 bottom-0 h-1/2 rounded-full blur-3xl"
        style={{
          opacity: 0.25 * intensity,
          animationDelay: '-9s',
          background: 'radial-gradient(ellipse at center, #ff7a00 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------- 레이아웃 --- */

export function Screen({
  children,
  className = '',
  withTabBar,
  fog = true,
}: {
  children: ReactNode
  className?: string
  withTabBar?: boolean
  fog?: boolean
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-void">
      {fog && <FogLayer />}
      <div
        className={`safe-t relative z-10 flex flex-1 flex-col ${withTabBar ? 'pb-[calc(76px+env(safe-area-inset-bottom))]' : 'safe-b'} ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
      <div className="anim-float text-5xl opacity-70" aria-hidden>
        {icon}
      </div>
      <p className="font-bold text-lilac">{title}</p>
      {desc && <p className="text-sm text-muted">{desc}</p>}
    </div>
  )
}

/** 화면 상단 제목 줄 */
export function ScreenTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <h1 className="text-xl font-black tracking-tight text-ghost-white">{title}</h1>
      {right}
    </div>
  )
}
