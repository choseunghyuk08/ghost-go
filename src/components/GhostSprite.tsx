import type { GhostShape, Rarity, Attribute } from '../types'

/**
 * 유령 스프라이트 — 20종 전부 서로 다른 실루엣.
 *
 * PNG 대신 SVG 를 쓰는 이유:
 *  - 어떤 해상도에서도 또렷하다 (도감 썸네일 ~ 발견 연출 대형 표시)
 *  - 20종 전부 합쳐도 수 KB. 이미지 다운로드가 사실상 0
 *  - 등급/속성에 따라 색을 코드로 바꿀 수 있다
 *
 * 공통 규칙(기획서 PART 1 §3-1):
 *  - 모든 유령은 하반신이 안개로 흩어진다
 *  - 눈은 단순한 두 점 — 귀엽고 살짝 무서운 톤
 *  - 아키타입마다 상반신 형태가 확실히 달라야 한다
 *
 * ⚠️ 이 스프라이트는 "게임이 굴러가는 기본 아트"다.
 *    마누스에게 맡길 최종 일러스트로 교체할 수 있게 shape 키만 맞추면 된다.
 */

const ATTR_COLOR: Record<Attribute, string> = {
  DUST: '#c9b8a8',
  SOUND: '#7dd3fc',
  WATER: '#4cc9f0',
  LIGHT: '#ffe066',
  SHADOW: '#8b5cf6',
  PAPER: '#e8dcc8',
  METAL: '#94a3b8',
  TIME: '#ffd166',
}

const RARITY_AURA: Record<Rarity, string> = {
  COMMON: '#9aa5b1',
  RARE: '#4cc9f0',
  EPIC: '#9d4edd',
  LEGENDARY: '#ff7a00',
  MYTHIC: '#ff3d81',
}

/** 하반신 안개 자락 — 모든 유령 공통 */
function Tail({ w = 62, y = 84 }: { w?: number; y?: number }) {
  const x = 50 - w / 2
  return (
    <path
      d={`M${x} ${y}
          q ${w * 0.12} 12 ${w * 0.25} 2
          q ${w * 0.12} -10 ${w * 0.25} 2
          q ${w * 0.13} 12 ${w * 0.25} 1
          q ${w * 0.12} -9 ${w * 0.25} 3
          L${x + w} ${y - 6} L${x} ${y - 6} Z`}
      fill="currentColor"
      opacity="0.92"
    />
  )
}

function Eyes({ cx = 50, cy = 52, gap = 13, r = 3.6 }: { cx?: number; cy?: number; gap?: number; r?: number }) {
  return (
    <g fill="#140a22">
      <ellipse cx={cx - gap} cy={cy} rx={r} ry={r * 1.15} />
      <ellipse cx={cx + gap} cy={cy} rx={r} ry={r * 1.15} />
      <circle cx={cx - gap + 1.2} cy={cy - 1.3} r={r * 0.32} fill="#fff" opacity="0.9" />
      <circle cx={cx + gap + 1.2} cy={cy - 1.3} r={r * 0.32} fill="#fff" opacity="0.9" />
    </g>
  )
}

function Blush({ cy = 60 }: { cy?: number }) {
  return (
    <g fill="#ff7a9c" opacity="0.35">
      <ellipse cx="33" cy={cy} rx="5" ry="3" />
      <ellipse cx="67" cy={cy} rx="5" ry="3" />
    </g>
  )
}

/* ------------------------------------------------------------------------ */
/* 아키타입별 몸통                                                            */
/* ------------------------------------------------------------------------ */

const BODIES: Record<GhostShape, () => React.ReactElement> = {
  // 복도령 — 세로로 긴 리본형, 머리 위에 실내화
  ribbon: () => (
    <>
      <path d="M34 30 q16 -14 32 0 v54 h-32 Z" fill="currentColor" />
      <Tail w={44} />
      <path d="M40 20 q10 -7 20 0 q-3 6 -10 6 q-7 0 -10 -6 Z" fill="#e8dcc8" opacity="0.85" />
      <Eyes gap={9} />
    </>
  ),

  // 사물함귀신 — 직육면체, 손잡이 코
  box: () => (
    <>
      <rect x="26" y="26" width="48" height="58" rx="5" fill="currentColor" />
      <Tail w={52} />
      <rect x="31" y="31" width="38" height="10" rx="2" fill="#140a22" opacity="0.25" />
      <rect x="66" y="52" width="4" height="12" rx="2" fill="#140a22" opacity="0.5" />
      <Eyes cy={56} gap={11} />
    </>
  ),

  // 칠판귀신 — 가로로 넓은 판, 분필가루
  board: () => (
    <>
      <rect x="16" y="34" width="68" height="48" rx="4" fill="currentColor" />
      <Tail w={68} y={82} />
      <rect x="16" y="34" width="68" height="48" rx="4" fill="none" stroke="#8b6f47" strokeWidth="3" />
      <Eyes cy={56} gap={14} />
      <g fill="#fff" opacity="0.55">
        <circle cx="24" cy="26" r="1.6" />
        <circle cx="36" cy="20" r="1.2" />
        <circle cx="70" cy="24" r="1.4" />
      </g>
    </>
  ),

  // 급식실령 — 납작한 식판, 김
  tray: () => (
    <>
      <rect x="20" y="42" width="60" height="40" rx="10" fill="currentColor" />
      <Tail w={60} y={82} />
      <g stroke="#140a22" strokeWidth="1.5" opacity="0.28" fill="none">
        <line x1="50" y1="46" x2="50" y2="78" />
        <line x1="24" y1="62" x2="76" y2="62" />
      </g>
      <Eyes cy={56} gap={13} />
      <g stroke="#fff" strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round">
        <path d="M38 34 q4 -6 0 -12" />
        <path d="M50 30 q4 -7 0 -14" />
        <path d="M62 34 q4 -6 0 -12" />
      </g>
    </>
  ),

  // 정수기령 — 물방울, 내부 기포
  drop: () => (
    <>
      <path d="M50 16 q22 30 22 44 a22 22 0 0 1 -44 0 q0 -14 22 -44 Z" fill="currentColor" />
      <Tail w={40} y={84} />
      <g fill="#fff" opacity="0.35">
        <circle cx="42" cy="66" r="3" />
        <circle cx="56" cy="72" r="2" />
        <circle cx="48" cy="78" r="1.5" />
      </g>
      <Eyes cy={56} gap={11} />
    </>
  ),

  // 우산꽂이령 — 가늘고 긴 우산, 굽은 손잡이
  rod: () => (
    <>
      <path d="M44 22 q6 -6 12 0 v60 h-12 Z" fill="currentColor" />
      <Tail w={30} />
      <path d="M56 74 q10 2 8 12 q-1 5 -6 4" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
      <Eyes cy={48} gap={5} r={2.8} />
      <g fill="#4cc9f0" opacity="0.6">
        <circle cx="34" cy="70" r="2" />
        <circle cx="66" cy="80" r="1.6" />
      </g>
    </>
  ),

  // 화분령 — 잎사귀 머리
  leaf: () => (
    <>
      <path d="M32 46 h36 l-5 38 h-26 Z" fill="currentColor" />
      <Tail w={36} />
      <g fill="#5fbf6a">
        <path d="M50 44 q-16 -6 -18 -22 q16 2 18 22 Z" />
        <path d="M50 44 q16 -6 18 -22 q-16 2 -18 22 Z" />
        <path d="M50 44 q-3 -18 0 -28 q3 10 0 28 Z" />
      </g>
      <Eyes cy={62} gap={9} r={3} />
      <Blush cy={68} />
    </>
  ),

  // 게시판령 — 겹친 종이, 말린 모서리
  paper: () => (
    <>
      <rect x="30" y="30" width="42" height="54" rx="2" fill="currentColor" opacity="0.55" transform="rotate(-6 51 57)" />
      <rect x="26" y="28" width="44" height="56" rx="2" fill="currentColor" />
      <Tail w={44} />
      <path d="M26 28 l10 0 l-10 10 Z" fill="#140a22" opacity="0.22" />
      <Eyes cx={48} cy={56} gap={10} />
      <g fill="currentColor" opacity="0.5">
        <rect x="78" y="34" width="7" height="9" rx="1" transform="rotate(18 81 38)" />
        <rect x="14" y="46" width="6" height="8" rx="1" transform="rotate(-22 17 50)" />
      </g>
    </>
  ),

  // 계단귀신 — 3단 꺾임
  stair: () => (
    <>
      <path d="M20 84 v-18 h18 v-18 h18 v-18 h20 v54 Z" fill="currentColor" />
      <Tail w={56} />
      <Eyes cx={62} cy={44} gap={9} r={3.2} />
      <g stroke="#140a22" strokeWidth="1.5" opacity="0.2">
        <line x1="20" y1="66" x2="38" y2="66" />
        <line x1="38" y1="48" x2="56" y2="48" />
      </g>
    </>
  ),

  // 과학실령 — 삼각플라스크
  flask: () => (
    <>
      <path d="M42 20 h16 v18 l16 40 a6 6 0 0 1 -5 8 h-38 a6 6 0 0 1 -5 -8 l16 -40 Z" fill="currentColor" />
      <Tail w={48} y={84} />
      <path d="M32 66 h36 l6 12 a6 6 0 0 1 -5 8 h-38 a6 6 0 0 1 -5 -8 Z" fill="#7dffb0" opacity="0.45" />
      <rect x="40" y="16" width="20" height="5" rx="2.5" fill="currentColor" />
      <Eyes cy={54} gap={9} r={3.2} />
    </>
  ),

  // 음악실령 — 음자리표 곡선 + 음표 공전
  note: () => (
    <>
      <path d="M40 24 q22 -4 22 18 q0 16 -14 26 q-12 8 -12 18 h28" stroke="currentColor" strokeWidth="11" fill="none" strokeLinecap="round" />
      <Tail w={40} />
      <Eyes cx={52} cy={44} gap={8} r={3} />
      <g fill="#7dd3fc">
        <circle cx="22" cy="34" r="3.5" />
        <rect x="24.5" y="24" width="2" height="11" />
        <circle cx="80" cy="52" r="3" />
        <rect x="82" y="43" width="2" height="10" />
      </g>
    </>
  ),

  // 체육관령 — 둥근 공 머리 + 넓은 어깨
  ball: () => (
    <>
      <circle cx="50" cy="46" r="24" fill="currentColor" />
      <path d="M22 78 q28 -12 56 0 v6 h-56 Z" fill="currentColor" />
      <Tail w={58} />
      <g stroke="#140a22" strokeWidth="2" fill="none" opacity="0.25">
        <path d="M30 34 q20 12 40 0" />
        <path d="M30 58 q20 -12 40 0" />
      </g>
      <Eyes cy={46} gap={10} />
    </>
  ),

  // 소화전령 — 붉은 함 + 호스 팔
  hydrant: () => (
    <>
      <rect x="30" y="28" width="40" height="56" rx="4" fill="currentColor" />
      <Tail w={44} />
      <rect x="35" y="34" width="30" height="26" rx="2" fill="#fff" opacity="0.18" />
      <g stroke="#fff" strokeWidth="1" opacity="0.4">
        <line x1="50" y1="34" x2="38" y2="60" />
        <line x1="50" y1="34" x2="62" y2="58" />
        <line x1="50" y1="34" x2="50" y2="60" />
      </g>
      <Eyes cy={46} gap={9} r={3.2} />
      <path d="M30 62 q-14 4 -12 18" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M70 62 q14 4 12 18" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
    </>
  ),

  // 분실물령 — 불규칙 뭉치 + 이름표
  bundle: () => (
    <>
      <path d="M28 44 q6 -18 24 -14 q18 -8 22 12 q10 8 2 22 q4 16 -12 20 h-26 q-14 -6 -10 -22 q-8 -10 0 -18 Z" fill="currentColor" />
      <Tail w={50} />
      <Eyes cy={54} gap={10} />
      <rect x="58" y="72" width="16" height="10" rx="2" fill="#e8dcc8" transform="rotate(12 66 77)" />
      <line x1="58" y1="70" x2="52" y2="64" stroke="#e8dcc8" strokeWidth="1.5" />
    </>
  ),

  // 도서관령 — 펼친 책 날개
  book: () => (
    <>
      <path d="M50 34 q-22 -8 -30 4 v40 q8 -10 30 -4 Z" fill="currentColor" />
      <path d="M50 34 q22 -8 30 4 v40 q-8 -10 -30 -4 Z" fill="currentColor" opacity="0.82" />
      <rect x="47" y="32" width="6" height="48" rx="2" fill="currentColor" />
      <Tail w={44} y={86} />
      <Eyes cy={52} gap={11} r={3.2} />
      <g stroke="#140a22" strokeWidth="1" opacity="0.2">
        <line x1="26" y1="48" x2="42" y2="50" />
        <line x1="58" y1="50" x2="74" y2="48" />
      </g>
    </>
  ),

  // 거울귀신 — 타원 프레임 + 균열
  mirror: () => (
    <>
      <ellipse cx="50" cy="52" rx="26" ry="32" fill="currentColor" />
      <ellipse cx="50" cy="52" rx="20" ry="26" fill="#1c1033" />
      <Tail w={40} />
      <g stroke="currentColor" strokeWidth="1.4" opacity="0.75">
        <line x1="50" y1="52" x2="36" y2="32" />
        <line x1="50" y1="52" x2="66" y2="36" />
        <line x1="50" y1="52" x2="40" y2="74" />
        <line x1="50" y1="52" x2="64" y2="70" />
      </g>
      <Eyes cy={48} gap={9} r={3} />
    </>
  ),

  // 방송실령 — 마이크 머리 + 케이블 몸통
  mic: () => (
    <>
      <rect x="36" y="18" width="28" height="38" rx="14" fill="currentColor" />
      <g stroke="#140a22" strokeWidth="1.2" opacity="0.25">
        <line x1="38" y1="28" x2="62" y2="28" />
        <line x1="38" y1="36" x2="62" y2="36" />
        <line x1="38" y1="44" x2="62" y2="44" />
      </g>
      <path d="M50 56 q-12 10 -6 22 q4 8 -4 8" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
      <Tail w={38} />
      <Eyes cy={34} gap={8} r={3} />
      <circle cx="72" cy="24" r="4" fill="#ff3d81" />
    </>
  ),

  // 석고상령 — 두상, 파인 눈
  bust: () => (
    <>
      <path d="M32 42 q0 -22 18 -22 q18 0 18 22 q0 22 -6 30 h-24 q-6 -8 -6 -30 Z" fill="currentColor" />
      <path d="M30 72 h40 l4 12 h-48 Z" fill="currentColor" />
      <Tail w={52} y={86} />
      <g fill="#140a22" opacity="0.55">
        <ellipse cx="42" cy="44" rx="4" ry="5" />
        <ellipse cx="58" cy="44" rx="4" ry="5" />
      </g>
      <path d="M50 48 v10" stroke="#140a22" strokeWidth="1.5" opacity="0.3" />
      <g stroke="#140a22" strokeWidth="0.8" opacity="0.25">
        <path d="M36 30 q4 12 2 24" />
        <path d="M64 34 q-3 10 -1 20" />
      </g>
    </>
  ),

  // 시계귀신 — 시계 문자판
  clock: () => (
    <>
      <circle cx="50" cy="48" r="28" fill="currentColor" />
      <circle cx="50" cy="48" r="22" fill="#1c1033" opacity="0.65" />
      <Tail w={44} y={84} />
      <g stroke="#ffd166" strokeWidth="3" strokeLinecap="round">
        <line x1="50" y1="48" x2="50" y2="32" />
        <line x1="50" y1="48" x2="62" y2="54" />
      </g>
      <g fill="#ffd166" opacity="0.8">
        <circle cx="50" cy="28" r="1.6" />
        <circle cx="70" cy="48" r="1.6" />
        <circle cx="50" cy="68" r="1.6" />
        <circle cx="30" cy="48" r="1.6" />
      </g>
      <Eyes cy={44} gap={11} r={3} />
    </>
  ),

  // 제13교실령 — 있을 리 없는 문
  door: () => (
    <>
      <rect x="28" y="18" width="44" height="66" rx="3" fill="currentColor" />
      <rect x="33" y="23" width="34" height="24" rx="2" fill="#0b0614" opacity="0.72" />
      <Tail w={48} />
      <text x="50" y="40" textAnchor="middle" fontSize="15" fontWeight="900" fill="#ff3d81" opacity="0.95">
        13
      </text>
      <circle cx="64" cy="60" r="3" fill="#140a22" opacity="0.55" />
      <Eyes cy={66} gap={10} r={3} />
      <g fill="#ff3d81" opacity="0.55">
        <circle cx="20" cy="30" r="1.6" />
        <circle cx="82" cy="46" r="1.4" />
      </g>
    </>
  ),
}

/* ------------------------------------------------------------------------ */

export interface GhostSpriteProps {
  shape: GhostShape
  rarity: Rarity
  attribute: Attribute
  size?: number
  /** 부유 애니메이션 */
  float?: boolean
  /** 등급 오라 */
  aura?: boolean
  className?: string
}

export function GhostSprite({
  shape,
  rarity,
  attribute,
  size = 96,
  float = true,
  aura = false,
  className = '',
}: GhostSpriteProps) {
  const Body = BODIES[shape] ?? BODIES.ribbon
  const color = ATTR_COLOR[attribute] ?? '#c3aede'
  const auraColor = RARITY_AURA[rarity]

  return (
    <div
      className={`relative inline-block ${float ? 'anim-float' : ''} ${className}`}
      style={{ width: size, height: size * 1.2 }}
    >
      {aura && (
        <div
          className="anim-glow absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${auraColor}88 0%, transparent 68%)` }}
          aria-hidden
        />
      )}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size * 1.2}
        className="relative"
        style={{ color, filter: `drop-shadow(0 4px 12px ${auraColor}55)` }}
        role="img"
      >
        <Body />
      </svg>
    </div>
  )
}

/** 미발견 유령 — 검은 실루엣과 물음표 */
export function GhostSilhouette({ size = 72 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size * 1.2 }}>
      <svg viewBox="0 0 100 100" width={size} height={size * 1.2} aria-hidden>
        <path d="M30 34 q20 -18 40 0 v50 h-40 Z" fill="#2a1b47" />
        <path
          d="M30 84 q7 10 14 2 q7 -9 14 2 q7 10 12 -2 L70 78 L30 78 Z"
          fill="#2a1b47"
        />
      </svg>
      <span className="absolute text-2xl font-black text-muted/70">?</span>
    </div>
  )
}
