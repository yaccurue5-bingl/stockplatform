-- ============================================================
-- Migration 031: scores_log 에 future_return_3d 추가
-- ============================================================
-- 목적: 공시 이후 3 영업일 수익률을 저장한다.
--       기존 future_return_5d(T+5) / future_return_20d(T+20)와 함께
--       backtest 엔진의 T+3 exit 전략에 활용한다.
--
-- backfill_prices.py 가 T3_CALENDAR_DAYS(≒5달력일)로 계산해 upsert.
-- ============================================================

ALTER TABLE public.scores_log
  ADD COLUMN IF NOT EXISTS future_return_3d FLOAT;

COMMENT ON COLUMN public.scores_log.future_return_3d IS
  '공시일 대비 T+3 영업일 종가 수익률 (%). backtest_engine 의 T+3 exit 기준.';
