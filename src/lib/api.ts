/**
 * API 클라이언트
 *
 * 서버(Cloudflare Pages Functions)가 모든 게임 판정을 하므로
 * 클라이언트는 "요청하고 결과를 보여주는" 역할만 한다.
 * XP·레벨·순위를 클라이언트에서 계산하지 않는다.
 */

import type { Rarity, Attribute, GhostShape } from '../types'

const TOKEN_KEY = 'ghostgo.token'
const NICK_KEY = 'ghostgo.nickname'

/* ------------------------------------------------------------- 저장소 --- */

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSession(token: string, nickname: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(NICK_KEY, nickname)
  } catch {
    /* 시크릿 모드 등에서 실패해도 세션은 메모리로 유지된다 */
  }
}

export function getSavedNickname(): string | null {
  try {
    return localStorage.getItem(NICK_KEY)
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(NICK_KEY)
  } catch {
    /* noop */
  }
}

/* --------------------------------------------------------------- 타입 --- */

export interface ApiPlayer {
  id: string
  nickname: string
  xp: number
  coins: number
  level: number
  title: string
  uniqueGhosts: number
  totalCatches: number
  levelProgress: {
    level: number
    current: number
    needed: number
    ratio: number
    isMax: boolean
  }
}

/** 발견한 유령 */
export interface DexFound {
  ghostId: string
  no: number
  found: true
  name: string
  desc: string
  rarity: Rarity
  attribute: Attribute
  shape: GhostShape
  floor: number
  firstAt: number
  lastAt: number
  count: number
}

/** 미발견 — 서버가 이름·설명·실루엣을 내려주지 않는다 */
export interface DexHidden {
  ghostId: string
  no: number
  found: false
  rarity: Rarity
}

export type DexEntry = DexFound | DexHidden

export interface EventState {
  status: 'before' | 'running' | 'ended'
  open: boolean
  message: string | null
  startsAt: number | null
  endsAt: number | null
  rankingFrozen: boolean
}

export interface StateResponse {
  ok: true
  player: ApiPlayer
  dex: DexEntry[]
  totalGhosts: number
  event: EventState
}

export interface ScanSuccess {
  ok: true
  replayed?: boolean
  isNew: boolean
  rewarded: boolean
  ghost: {
    ghostId: string
    no: number
    name: string
    desc: string
    rarity: Rarity
    attribute: Attribute
    shape: GhostShape
    floor: number
  }
  xpGained: number
  coinGained: number
  levelBefore: number
  levelAfter: number
  leveledUp: boolean
  totalXp: number
  totalCoins: number
  uniqueGhosts: number
  totalCatches: number
  totalGhosts: number
  rank: number
  rankBefore: number
  rankUp: boolean
  duplicateLine?: string
}

export interface ApiError {
  ok: false
  reason: string
  message: string
  retryAfterSec?: number
  replayed?: boolean
}

export type ScanResponse = ScanSuccess | ApiError

export interface RankEntry {
  rank: number
  isMe: boolean
  nickname: string
  level: number
  title: string
  xp: number
  uniqueGhosts: number
  totalCatches: number
}

export interface RankingResponse {
  ok: true
  sort: string
  scope: 'today' | 'all'
  frozen: boolean
  dayStart: number
  top: RankEntry[]
  totalPlayers: number
  me: {
    rank: number
    nickname: string
    level: number
    title: string
    xp: number
    uniqueGhosts: number
    totalCatches: number
    gapXp: number
    hint: string | null
  }
}

export interface RegisterResponse {
  ok: true
  token: string
  recoveryCode: string
  player: {
    id: string
    nickname: string
    xp: number
    coins: number
    level: number
    uniqueGhosts: number
    totalCatches: number
  }
}

/* ----------------------------------------------------------- 요청 래퍼 --- */

class NetworkError extends Error {
  reason = 'network'
  constructor() {
    super('연결이 불안정해요. 신호가 잡히면 다시 시도해 주세요.')
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T | ApiError> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    return { ok: false, reason: 'network', message: new NetworkError().message }
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return { ok: false, reason: 'network', message: '서버 응답을 읽지 못했어요.' }
  }

  if (res.status === 401) {
    clearSession()
  }
  return data as T | ApiError
}

export const isError = (r: unknown): r is ApiError =>
  typeof r === 'object' && r !== null && (r as { ok?: boolean }).ok === false

/* ------------------------------------------------------------- 엔드포인트 --- */

export function checkNickname(nickname: string) {
  return request<{ ok: true; available: boolean; message: string | null }>(
    `/api/register?nickname=${encodeURIComponent(nickname)}`,
  )
}

export function register(nickname: string) {
  return request<RegisterResponse>('/api/register', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  })
}

export function fetchState() {
  return request<StateResponse>('/api/state')
}

export function fetchRanking(sort = 'xp', scope: 'today' | 'all' = 'today') {
  return request<RankingResponse>(`/api/ranking?sort=${sort}&scope=${scope}`)
}

/** 멱등키를 붙여 보낸다 — 네트워크 재시도로 보상이 두 번 지급되지 않도록 */
export function scan(slug: string, idem?: string) {
  return request<ScanSuccess>('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ slug, idem: idem ?? crypto.randomUUID() }),
  })
}
