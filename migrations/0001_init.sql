-- ===========================================================================
-- 고스트 GO — D1(SQLite) 초기 스키마
-- PHASE 1 범위: 플레이어 / 유령 / QR코드 / 발견 / 스캔원장 / 이벤트설정
-- 미션·배지는 PHASE 2에서 추가 (테이블만 미리 만들지 않음 — 스키마 변경 비용이 낮음)
-- ===========================================================================

-- --- 플레이어 -------------------------------------------------------------
-- 개인정보 미수집 (사양 §43): 내부 ID + 사용자가 지은 익명 닉네임만 저장한다.
-- 실명·학번·전화·이메일·GPS·사진은 어떤 컬럼으로도 받지 않는다.
CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,             -- 서버 생성 익명 ID (개인정보와 무관)
  nickname        TEXT NOT NULL,                -- 고스트 헌터 ID, 2~12자
  xp              INTEGER NOT NULL DEFAULT 0,
  coins           INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 1,
  -- 랭킹 정렬용 비정규화 카운터 (사양 §39·§44)
  unique_ghosts   INTEGER NOT NULL DEFAULT 0,   -- 발견한 유령 '종류' 수
  total_catches   INTEGER NOT NULL DEFAULT 0,   -- 총 포획 횟수 (중복 포함)
  recovery_code   TEXT NOT NULL UNIQUE,         -- GG-XXXX-XXXX 계정 유실 복구용
  created_at      INTEGER NOT NULL,
  last_active_at  INTEGER NOT NULL,
  last_scan_at    INTEGER,
  is_blocked      INTEGER NOT NULL DEFAULT 0    -- 운영자 차단
);

-- 닉네임 중복 금지 (사양 §34) — 대소문자 구분 없이 유일
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_nickname
  ON players (nickname COLLATE NOCASE);

-- 랭킹 정렬 (사양 §39)
--   1순위 총 XP ↓ / 2순위 유령 종류 수 ↓ / 3순위 총 포획 수 ↓ / 4순위 먼저 가입한 사람 ↑
CREATE INDEX IF NOT EXISTS idx_players_rank
  ON players (xp DESC, unique_ghosts DESC, total_catches DESC, created_at ASC);

-- --- 유령 마스터 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ghosts (
  ghost_id      TEXT PRIMARY KEY,
  no            INTEGER NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  rarity        TEXT NOT NULL CHECK (rarity IN ('COMMON','RARE','EPIC','LEGENDARY','MYTHIC')),
  attribute     TEXT NOT NULL,
  shape         TEXT NOT NULL,                  -- SVG 실루엣 아키타입
  floor         INTEGER NOT NULL CHECK (floor BETWEEN 1 AND 3),
  xp_reward     INTEGER NOT NULL,
  coin_reward   INTEGER NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,     -- 운영자가 개별 비활성화 (안전 이슈 대응)
  active_from   INTEGER,                        -- 등급별 순차 해금 (Day2 Epic, Day3 Legendary/Mythic)
  active_until  INTEGER                         -- Mythic 60분 한정 게이트
);

-- --- QR 코드 (슬러그 → 유령) ---------------------------------------------
-- 유령 1종당 카드 3장 = 서로 다른 슬러그 3개가 같은 ghost_id를 가리킨다.
-- 500명 대기열 분산 목적 (확정문서 v2 §6).
CREATE TABLE IF NOT EXISTS codes (
  slug        TEXT PRIMARY KEY,                 -- GG1-XXXXXXXXXX (추측 불가)
  ghost_id    TEXT NOT NULL REFERENCES ghosts(ghost_id) ON DELETE CASCADE,
  copy_no     INTEGER NOT NULL,                 -- 1 | 2 | 3
  placement   TEXT,                             -- 운영자 메모 (학생에게 노출 금지)
  is_active   INTEGER NOT NULL DEFAULT 1,
  scan_count  INTEGER NOT NULL DEFAULT 0        -- 0이면 "아무도 못 찾음 = 인식 불가 의심"
);

CREATE INDEX IF NOT EXISTS idx_codes_ghost ON codes (ghost_id);

-- --- 발견 기록 (도감) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS discoveries (
  player_id            TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  ghost_id             TEXT NOT NULL REFERENCES ghosts(ghost_id) ON DELETE CASCADE,
  first_discovered_at  INTEGER NOT NULL,
  last_scanned_at      INTEGER NOT NULL,
  scan_count           INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (player_id, ghost_id)             -- 도감 중복 등록을 DB가 차단
);

-- --- 스캔 원장 ------------------------------------------------------------
-- 시상은 반드시 이 원장으로 재계산한다. 실패한 스캔도 남겨야 부정탐지·운영진단이 된다.
CREATE TABLE IF NOT EXISTS scan_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id    TEXT NOT NULL,
  slug         TEXT,
  ghost_id     TEXT,
  is_new       INTEGER NOT NULL DEFAULT 0,
  xp_gained    INTEGER NOT NULL DEFAULT 0,
  coin_gained  INTEGER NOT NULL DEFAULT 0,
  result       TEXT NOT NULL,                   -- ok | not_found | cooldown | event_ended ...
  idem_key     TEXT,                            -- 네트워크 재시도 중복지급 방지
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scanlogs_player ON scan_logs (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanlogs_slug   ON scan_logs (slug, created_at DESC);

-- 멱등성: 같은 (player, idem_key)는 단 한 번만 기록된다 (PART 0 모순 8 대응)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scanlogs_idem
  ON scan_logs (player_id, idem_key) WHERE idem_key IS NOT NULL;

-- --- 이벤트 설정 (단일 행) ------------------------------------------------
CREATE TABLE IF NOT EXISTS event_config (
  id                        INTEGER PRIMARY KEY CHECK (id = 1),
  status                    TEXT NOT NULL DEFAULT 'before',  -- before | running | ended
  starts_at                 INTEGER,
  ends_at                   INTEGER,
  -- 중복 발견 보상 (사양 §40): 신규보다 훨씬 적게 주되 0은 아니다
  duplicate_xp              INTEGER NOT NULL DEFAULT 10,
  duplicate_coin            INTEGER NOT NULL DEFAULT 2,
  duplicate_reward_enabled  INTEGER NOT NULL DEFAULT 1,
  -- 어뷰즈 방지 (사양 §40) — 운영 중 관리자가 조정 가능
  same_ghost_cooldown_sec   INTEGER NOT NULL DEFAULT 60,     -- 동일 유령 재스캔 보상 제한
  scan_cooldown_sec         INTEGER NOT NULL DEFAULT 3,      -- 전역 연타 방지
  max_scans_per_min         INTEGER NOT NULL DEFAULT 12,
  same_ghost_daily_limit    INTEGER NOT NULL DEFAULT 0,      -- 1이면 같은 유령 하루 1회만 보상
  -- 최종 랭킹 확정 (사양 §45): 종료 후 순위가 더 이상 변하지 않도록 동결
  ranking_frozen            INTEGER NOT NULL DEFAULT 0,
  frozen_at                 INTEGER
);

INSERT OR IGNORE INTO event_config (id, status) VALUES (1, 'running');
