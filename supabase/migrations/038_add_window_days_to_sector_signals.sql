-- migration 038: sector_signals에 window_days 컬럼 추가
-- sector rotation 구현 준비 (7일 단기 vs 30일 중기 집계 비교)
--
-- 현재 upsert key: (date, sector_en)
-- 변경 후 upsert key: (date, sector_en, window_days)
-- → 같은 날짜에 window_days=7 / window_days=30 두 행 공존 가능

-- 1. 컬럼 추가 (기존 데이터 = 30일 집계이므로 DEFAULT 30)
ALTER TABLE sector_signals
  ADD COLUMN IF NOT EXISTS window_days INTEGER NOT NULL DEFAULT 30;

-- 2. 기존 unique constraint 교체
--    기존: (date, sector_en)
--    신규: (date, sector_en, window_days)
ALTER TABLE sector_signals
  DROP CONSTRAINT IF EXISTS sector_signals_date_sector_en_key;

ALTER TABLE sector_signals
  ADD CONSTRAINT sector_signals_date_sector_en_window_key
  UNIQUE (date, sector_en, window_days);

-- 3. 인덱스: window_days 단독 조회 지원 (ex: window_days=7 최신 날짜)
CREATE INDEX IF NOT EXISTS idx_sector_signals_window_days
  ON sector_signals (window_days, date DESC);

COMMENT ON COLUMN sector_signals.window_days IS
  '집계 윈도우 (일): 7 = 단기, 30 = 중기. /sector/rotation 구현 시 두 윈도우 비교.';
