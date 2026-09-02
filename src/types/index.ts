/**
 * 고스트 GO 공용 타입
 * 확정 문서: GHOST_GO_확정사항_v2_Firebase.md §4-2
 * Firestore는 camelCase로 통일한다 (모순 10 재결정).
 */

export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC'

export type Attribute =
  | 'DUST'
  | 'SOUND'
  | 'WATER'
  | 'LIGHT'
  | 'SHADOW'
  | 'PAPER'
  | 'METAL'
  | 'TIME'

export type Floor = 1 | 2 | 3

/** 유령 마스터 데이터 (시드 원본 = 단일 진실. 치명 이슈 2 대응) */
export interface GhostMaster {
  ghostId: string // GHOST_001
  no: number // 1
  name: string
  desc: string
  rarity: Rarity
  attribute: Attribute
  floor: Floor
  /** SVG 스프라이트 아키타입 — GhostSprite 컴포넌트가 해석 */
  shape: GhostShape
  /** 배치 장소 메모 (운영자용, 학생 화면에는 노출하지 않는다) */
  placement: string
  xpReward: number
  coinReward: number
}

/** 실루엣이 확실히 구분되도록 아키타입을 나눈다 (기획서 PART 1 §3-1) */
export type GhostShape =
  | 'ribbon' // 세로로 긴 리본형 — 복도령
  | 'box' // 직육면체 — 사물함귀신
  | 'board' // 가로로 넓은 판형 — 칠판귀신
  | 'tray' // 납작한 원형 식판 — 급식실령
  | 'drop' // 물방울 — 정수기령
  | 'rod' // 가늘고 긴 막대 — 우산꽂이령
  | 'leaf' // 잎사귀 머리 — 화분령
  | 'paper' // 겹친 종이 — 게시판령
  | 'stair' // 계단 단차 — 계단귀신
  | 'flask' // 삼각플라스크 — 과학실령
  | 'note' // 음자리표 곡선 — 음악실령
  | 'ball' // 둥근 공 — 체육관령
  | 'hydrant' // 붉은 함 — 소화전령
  | 'bundle' // 불규칙 뭉치 — 분실물령
  | 'book' // 펼친 책 — 도서관령
  | 'mirror' // 타원 거울 — 거울귀신
  | 'mic' // 마이크 — 방송실령
  | 'bust' // 두상 — 석고상령
  | 'clock' // 시계 — 시계귀신
  | 'door' // 문 — 제13교실령

/** Firestore: codes/{slug} — 문서 ID가 곧 QR 슬러그 */
export interface CodeDoc {
  ghostId: string
  ghostName: string
  ghostDesc: string
  rarity: Rarity
  attribute: Attribute
  shape: GhostShape
  floor: Floor
  xpReward: number
  coinReward: number
  isActive: boolean
  activeFrom: Date
  activeUntil: Date
  placement: string
  copyNo: number // 1 | 2 | 3 — 같은 유령의 몇 번째 카드인가
}

/** players/{uid}.discoveries[ghostId] — 비정규화 복사본 */
export interface DiscoveryEntry {
  firstAt: number // epoch ms
  lastAt: number
  count: number
  name: string
  desc: string
  rarity: Rarity
  attribute: Attribute
  shape: GhostShape
  floor: Floor
  no: number
}

/** Firestore: players/{uid} */
export interface PlayerDoc {
  nickname: string
  xp: number
  coins: number
  level: number
  discoveries: Record<string, DiscoveryEntry>
  missions: Record<string, { progress: number; completed: boolean; completedAt?: number }>
  badges: Record<string, number>
  lastScanAt: number | null
  lastScanSlug: string | null
  recoveryCode: string
  createdAt: number
  lastActiveAt: number
}

/** Firestore: eventConfig/current */
export interface EventConfig {
  status: 'before' | 'running' | 'ended'
  startsAt: number
  endsAt: number
  duplicateCoin: number
  rules: {
    scanCooldownSec: number
    maxScansPerMin: number
    sameGhostDailyLimit: boolean
    duplicateRewardEnabled: boolean
  }
}

/** Cloud Function `scanCode` 응답 */
export interface ScanResult {
  ok: true
  isNew: boolean
  ghost: {
    ghostId: string
    no: number
    name: string
    desc: string
    rarity: Rarity
    attribute: Attribute
    shape: GhostShape
    floor: Floor
  }
  xpGained: number
  coinGained: number
  levelBefore: number
  levelAfter: number
  totalXp: number
  totalCoins: number
  discoveredCount: number
  totalGhosts: number
  /** 중복 발견 시 랜덤 대사 */
  duplicateLine?: string
}

export interface ScanRejected {
  ok: false
  reason:
    | 'not_found'
    | 'event_not_started'
    | 'event_ended'
    | 'ghost_inactive'
    | 'cooldown'
    | 'rate_limited'
    | 'unauthenticated'
    | 'network'
  message: string
  retryAfterSec?: number
}

export type ScanResponse = ScanResult | ScanRejected

/** QR 스캐너 상태 머신 */
export type ScanPhase =
  | 'idle'
  | 'requesting' // 카메라 권한 요청 중
  | 'denied' // 권한 거부
  | 'scanning' // 프리뷰 + 디코딩
  | 'submitting' // 서버 검증 중
  | 'error'

/** 발견 연출 단계 (PART 2 §4 — 총 4,200ms) */
export type RevealStep =
  | 'blackout' // 0 ~ 600ms   암전
  | 'presence' // 600 ~ 1700  "무언가가 느껴집니다..."
  | 'emerge' // 1700 ~ 2700  실루엣 → 유령 등장
  | 'banner' // 2700 ~ 3400  NEW GHOST! / 이미 발견한 유령
  | 'reward' // 3400 ~ 4200  +XP / +Coin
  | 'card' // 4200~         유령 카드 + 도감 등록 버튼
