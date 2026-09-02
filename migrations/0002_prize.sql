-- ===========================================================================
-- 상품 지급 (음료수) — 유령 N마리 달성 시 교환권 발급, 스태프가 수령 확인
--
-- 운영 흐름
--   1. 학생이 N마리째 발견 → 서버가 교환권 발급 (prize_unlocked_at, prize_code)
--   2. 홈 화면에 "🎁 상품 받기" 배너 상시 표시
--   3. 부스에서 학생이 교환권 화면을 보여줌
--   4. 스태프가 그 폰에서 PIN 입력 → 수령 완료 기록 (prize_claimed_at)
--   5. 이후 새로고침해도 "이미 수령" 상태 — 중복 수령 차단
-- ===========================================================================

ALTER TABLE event_config ADD COLUMN prize_enabled   INTEGER NOT NULL DEFAULT 1;
-- 몇 마리를 모으면 상품을 주는가. 행사 중 음료 재고에 따라 올릴 수 있다.
ALTER TABLE event_config ADD COLUMN prize_threshold INTEGER NOT NULL DEFAULT 4;
ALTER TABLE event_config ADD COLUMN prize_name      TEXT    NOT NULL DEFAULT '음료수';
-- 스태프 확인용 PIN. 배포 후 반드시 임의값으로 바꿀 것.
ALTER TABLE event_config ADD COLUMN staff_pin       TEXT    NOT NULL DEFAULT '0000';

ALTER TABLE players ADD COLUMN prize_unlocked_at INTEGER;  -- 교환권 발급 시각
ALTER TABLE players ADD COLUMN prize_claimed_at  INTEGER;  -- 실제 수령 시각
ALTER TABLE players ADD COLUMN prize_code        TEXT;     -- 교환권 번호 (스태프 대조용)

-- 수령 현황 집계용
CREATE INDEX IF NOT EXISTS idx_players_prize
  ON players (prize_unlocked_at, prize_claimed_at);

-- 수령 원장 — 누가 언제 어느 스태프 단말에서 확인했는지
CREATE TABLE IF NOT EXISTS prize_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  TEXT NOT NULL,
  prize_code TEXT,
  result     TEXT NOT NULL,   -- ok | bad_pin | already | not_unlocked | disabled
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prizelogs_time ON prize_logs (created_at DESC);
