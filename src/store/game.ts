import { create } from 'zustand'
import {
  fetchState,
  getToken,
  isError,
  setSession,
  clearSession,
  register as apiRegister,
  type ApiPlayer,
  type DexEntry,
  type EventState,
  type ScanSuccess,
  type PrizeState,
} from '../lib/api'

/**
 * 게임 전역 상태.
 * 서버가 진실이므로 여기서는 서버 응답을 보관하고 화면에 뿌리는 일만 한다.
 * 스캔 결과는 서버가 계산한 값을 그대로 반영한다 (낙관적 갱신 금지 — 조작 여지와 불일치를 만든다).
 */

export type Boot = 'loading' | 'need-nickname' | 'ready' | 'error'

interface GameState {
  boot: Boot
  bootError: string | null
  player: ApiPlayer | null
  dex: DexEntry[]
  totalGhosts: number
  event: EventState | null
  prize: PrizeState | null
  recoveryCode: string | null

  /** 발견 연출로 넘길 직전 스캔 결과 */
  lastScan: ScanSuccess | null

  bootstrap: () => Promise<void>
  createPlayer: (nickname: string) => Promise<{ ok: boolean; message?: string }>
  refresh: () => Promise<void>
  setLastScan: (r: ScanSuccess | null) => void
  applyScan: (r: ScanSuccess) => void
  reset: () => void
}

export const useGame = create<GameState>((set, get) => ({
  boot: 'loading',
  bootError: null,
  player: null,
  dex: [],
  totalGhosts: 20,
  event: null,
  prize: null,
  recoveryCode: null,
  lastScan: null,

  async bootstrap() {
    if (!getToken()) {
      set({ boot: 'need-nickname' })
      return
    }
    const res = await fetchState()
    if (isError(res)) {
      if (res.reason === 'unauthenticated') {
        clearSession()
        set({ boot: 'need-nickname' })
      } else {
        set({ boot: 'error', bootError: res.message })
      }
      return
    }
    set({
      boot: 'ready',
      player: res.player,
      dex: res.dex,
      totalGhosts: res.totalGhosts,
      prize: res.prize,
      event: res.event,
    })
  },

  async createPlayer(nickname) {
    const res = await apiRegister(nickname)
    if (isError(res)) return { ok: false, message: res.message }
    setSession(res.token, res.player.nickname)
    set({ recoveryCode: res.recoveryCode })
    await get().bootstrap()
    return { ok: true }
  },

  async refresh() {
    const res = await fetchState()
    if (isError(res)) return
    set({
      player: res.player,
      dex: res.dex,
      totalGhosts: res.totalGhosts,
      prize: res.prize,
      event: res.event,
    })
  },

  setLastScan(r) {
    set({ lastScan: r })
  },

  /** 스캔 직후 화면이 즉시 최신값을 보이도록 서버가 준 수치를 반영 */
  applyScan(r) {
    const p = get().player
    if (p) {
      set({
        player: {
          ...p,
          xp: r.totalXp,
          coins: r.totalCoins,
          level: r.levelAfter,
          uniqueGhosts: r.uniqueGhosts,
          totalCatches: r.totalCatches,
        },
      })
    }
    // 도감·진행도는 서버 기준으로 다시 받는다
    void get().refresh()
  },

  reset() {
    clearSession()
    set({
      boot: 'need-nickname',
      player: null,
      dex: [],
      event: null,
      prize: null,
      lastScan: null,
      recoveryCode: null,
    })
  },
}))
