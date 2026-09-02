import type { GhostMaster, Rarity } from '../types'

/**
 * 유령 20종 마스터 데이터 — 단일 진실(Single Source of Truth)
 *
 * 치명 이슈 2 대응: 기획 축과 DB 축이 서로 다른 20종을 확정했던 문제를
 * 이 파일 하나로 통합한다. Firestore 시드(scripts/seed.mjs)도 이 파일을 읽는다.
 * 층별 배치는 1층 6종 / 2층 7종 / 3층 7종 (배지 조건과 반드시 일치해야 함).
 *
 * 등급 분포: Common 8 / Rare 6 / Epic 4 / Legendary 1 / Mythic 1
 */

/** 사양 §35 기준 등급별 보상. 키 이름은 GhostMaster 필드와 동일해야 스프레드가 성립한다. */
export const RARITY_REWARD: Record<Rarity, { xpReward: number; coinReward: number }> = {
  COMMON: { xpReward: 100, coinReward: 10 },
  RARE: { xpReward: 250, coinReward: 30 },
  EPIC: { xpReward: 500, coinReward: 50 },
  LEGENDARY: { xpReward: 1000, coinReward: 100 },
  MYTHIC: { xpReward: 2000, coinReward: 200 },
}

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic',
}

export const RARITY_STARS: Record<Rarity, number> = {
  COMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  MYTHIC: 6,
}

export const ATTRIBUTE_LABEL: Record<string, string> = {
  DUST: '먼지',
  SOUND: '소리',
  WATER: '물',
  LIGHT: '빛',
  SHADOW: '그림자',
  PAPER: '종이',
  METAL: '금속',
  TIME: '시간',
}

const r = (rarity: Rarity) => RARITY_REWARD[rarity]

export const GHOSTS: GhostMaster[] = [
  {
    ghostId: 'GHOST_001', no: 1, name: '복도령', rarity: 'COMMON', attribute: 'DUST', floor: 1, shape: 'ribbon',
    desc: '아무도 없는 복도에서 실내화 끄는 소리만 남기고 지나간다. 사실 그냥 산책 중이라 마주쳐도 인사만 하면 된다.',
    placement: '1층 중앙 복도 벽 (눈높이)', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_002', no: 2, name: '사물함귀신', rarity: 'COMMON', attribute: 'METAL', floor: 2, shape: 'box',
    desc: '닫히지 않는 사물함 문 뒤에서 백 년째 살고 있다. 남의 물건에는 관심 없고 문 여닫는 소리만 좋아한다.',
    placement: '2층 복도 사물함 열 끝', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_003', no: 3, name: '칠판귀신', rarity: 'COMMON', attribute: 'DUST', floor: 1, shape: 'board',
    desc: '지워진 글씨를 모아 자기 몸을 만들었다. 수업이 끝나면 칠판에 낙서를 남기고 도망간다.',
    placement: '1층 교실 뒤편 게시판', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_004', no: 4, name: '급식실령', rarity: 'COMMON', attribute: 'WATER', floor: 1, shape: 'tray',
    desc: '식판 위에 남은 김에서 태어났다. 잔반을 남기면 슬퍼하지만 화내지는 않는다.',
    placement: '1층 급식실 입구 배식대 옆', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_005', no: 5, name: '정수기령', rarity: 'COMMON', attribute: 'WATER', floor: 2, shape: 'drop',
    desc: '마지막 한 방울이 떨어질 때마다 조금씩 자란다. 물을 받아 가면 뒤에서 조용히 박수를 친다.',
    placement: '2층 복도 정수기 옆 벽', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_006', no: 6, name: '우산꽂이령', rarity: 'COMMON', attribute: 'WATER', floor: 1, shape: 'rod',
    desc: '비 오는 날 잊고 간 우산들이 뭉쳐 만들어졌다. 맑은 날엔 할 일이 없어 현관을 서성인다.',
    placement: '1층 현관 우산꽂이 뒤', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_007', no: 7, name: '화분령', rarity: 'COMMON', attribute: 'LIGHT', floor: 2, shape: 'leaf',
    desc: '창가 화분이 햇빛을 너무 오래 받아 정신이 들었다. 물 주는 사람만 기억한다.',
    placement: '2층 복도 창가 화분 옆', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_008', no: 8, name: '게시판령', rarity: 'COMMON', attribute: 'PAPER', floor: 3, shape: 'paper',
    desc: '압정에 눌린 종이들이 답답해서 스스로 떨어져 나왔다. 새 공지가 붙으면 제일 먼저 읽는다.',
    placement: '3층 복도 게시판 하단', ...r('COMMON'),
  },
  {
    ghostId: 'GHOST_009', no: 9, name: '계단귀신', rarity: 'RARE', attribute: 'SHADOW', floor: 2, shape: 'stair',
    desc: '계단 수를 세는 습관이 있어서, 한 칸이 더 있다고 우긴다. 뛰어 내려가는 학생을 제일 싫어한다.',
    // 모순 15 반영: 계단 내부가 아니라 계단실 진입 전 복도 벽면에 부착 (안전)
    placement: '2층 계단실 진입 전 복도 벽면 (계단 문 옆)', ...r('RARE'),
  },
  {
    ghostId: 'GHOST_010', no: 10, name: '과학실령', rarity: 'RARE', attribute: 'LIGHT', floor: 3, shape: 'flask',
    desc: '실험이 끝난 플라스크 안에 남은 빛으로 만들어졌다. 안전 수칙을 어기면 눈이 빨개진다.',
    placement: '3층 과학실 문 옆', ...r('RARE'),
  },
  {
    ghostId: 'GHOST_011', no: 11, name: '음악실령', rarity: 'RARE', attribute: 'SOUND', floor: 3, shape: 'note',
    desc: '아무도 없는 음악실에서 한 음만 계속 누른다. 화음을 들려주면 기분이 좋아진다.',
    placement: '3층 음악실 문 옆', ...r('RARE'),
  },
  {
    ghostId: 'GHOST_012', no: 12, name: '체육관령', rarity: 'RARE', attribute: 'SOUND', floor: 1, shape: 'ball',
    desc: '마룻바닥에서 나는 끽 소리를 먹고 산다. 경기 날엔 관중석 제일 위에서 응원한다.',
    placement: '1층 체육관 연결통로', ...r('RARE'),
  },
  {
    ghostId: 'GHOST_013', no: 13, name: '소화전령', rarity: 'RARE', attribute: 'METAL', floor: 2, shape: 'hydrant',
    desc: '한 번도 쓰인 적이 없어서 심심하다. 불이 나지 않기를 누구보다 바라는 유령.',
    placement: '2층 복도 소화전 옆 벽', ...r('RARE'),
  },
  {
    ghostId: 'GHOST_014', no: 14, name: '분실물령', rarity: 'RARE', attribute: 'PAPER', floor: 1, shape: 'bundle',
    desc: '주인을 못 찾은 물건들의 마음이 모여 태어났다. 이름표만 보면 눈물을 글썽인다.',
    placement: '1층 교무실 앞 분실물함', ...r('RARE'),
  },
  {
    ghostId: 'GHOST_015', no: 15, name: '도서관령', rarity: 'EPIC', attribute: 'PAPER', floor: 2, shape: 'book',
    desc: '아무도 빌려 가지 않은 책 속에서 나왔다. 조용히 해 달라는 뜻으로 책장을 딱 한 번 넘긴다.',
    placement: '2층 도서관 서가 사이 측면', ...r('EPIC'),
  },
  {
    ghostId: 'GHOST_016', no: 16, name: '거울귀신', rarity: 'EPIC', attribute: 'LIGHT', floor: 3, shape: 'mirror',
    desc: '거울에 비치지 않아서 늘 서운해한다. 자기를 봐 주는 사람에게만 모습을 보여 준다.',
    placement: '3층 화장실 앞 전신거울 옆', ...r('EPIC'),
  },
  {
    ghostId: 'GHOST_017', no: 17, name: '방송실령', rarity: 'EPIC', attribute: 'SOUND', floor: 2, shape: 'mic',
    desc: '점심시간 신청곡을 백 년째 기다리고 있다. 마이크가 켜지면 조용해진다.',
    placement: '2층 방송실 문 옆', ...r('EPIC'),
  },
  {
    ghostId: 'GHOST_018', no: 18, name: '석고상령', rarity: 'EPIC', attribute: 'DUST', floor: 3, shape: 'bust',
    desc: '미술실 구석에서 백 년 동안 같은 각도로 서 있었다. 아무도 안 볼 때만 목을 돌린다.',
    placement: '3층 미술실 문 옆', ...r('EPIC'),
  },
  {
    ghostId: 'GHOST_019', no: 19, name: '시계귀신', rarity: 'LEGENDARY', attribute: 'TIME', floor: 3, shape: 'clock',
    desc: '복도 시계가 1분 늦게 가는 건 전부 이 유령 탓이다. 종례 시간만은 정확히 맞춰 준다.',
    placement: '3층 복도 끝 벽시계 아래', ...r('LEGENDARY'),
  },
  {
    ghostId: 'GHOST_020', no: 20, name: '제13교실령', rarity: 'MYTHIC', attribute: 'SHADOW', floor: 3, shape: 'door',
    desc: '있을 리 없는 교실 문 앞에서만 나타난다. 문을 열어 본 학생은 아직 아무도 없다.',
    // 모순 15 반영: 옥상 계단이 아니라 복도 끝 평면에 배치
    placement: '3층 복도 끝 평면 (옥상 계단 아래)', ...r('MYTHIC'),
  },
]

export const TOTAL_GHOSTS = GHOSTS.length

export const GHOST_BY_ID = Object.fromEntries(GHOSTS.map((g) => [g.ghostId, g]))

/**
 * 레벨 임계값 (누적 XP)
 * 기획서 PART 1 §4-2: 20종 완주 = 7,300 XP → Lv.20 도달이 성립해야 한다.
 * Common 8×100 + Rare 6×250 + Epic 4×500 + Legendary 1×1000 + Mythic 1×2000 = 7,300
 */
export const LEVEL_THRESHOLDS: number[] = [
  0, 150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150, 3700, 4250, 4800, 5300, 5750, 6150, 6500,
  6750, 6920, 7030,
]

export const LEVEL_TITLES: Record<number, string> = {
  1: '신입 사냥꾼',
  2: '초보 고스트헌터',
  3: '견습 고스트헌터',
  4: '유령 추적자',
  5: '고스트 헌터',
  6: '복도의 관찰자',
  7: '어둠의 탐험가',
  8: '유령 감별사',
  9: '괴담 수집가',
  10: '유령 전문가',
  12: '심야의 추적자',
  14: '교내 괴담 박사',
  16: '유령들의 친구',
  18: '고스트 마스터',
  20: '전설의 고스트 헌터',
}

/** 누적 XP → 레벨 (1~20) */
export function levelFromXp(xp: number): number {
  let lv = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lv = i + 1
    else break
  }
  return lv
}

/** 현재 레벨의 칭호 (해당 레벨에 칭호가 없으면 그 아래 가장 가까운 칭호) */
export function titleFromLevel(level: number): string {
  for (let lv = level; lv >= 1; lv--) {
    if (LEVEL_TITLES[lv]) return LEVEL_TITLES[lv]
  }
  return LEVEL_TITLES[1]
}

/** 다음 레벨까지의 진행도 */
export function levelProgress(xp: number) {
  const level = levelFromXp(xp)
  const curBase = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextBase = LEVEL_THRESHOLDS[level] // undefined면 만렙
  if (nextBase === undefined) {
    return { level, current: xp - curBase, needed: 0, ratio: 1, isMax: true }
  }
  const current = xp - curBase
  const needed = nextBase - curBase
  return { level, current, needed, ratio: Math.min(1, current / needed), isMax: false }
}
