-- ============================================================
-- Migration 029: API Usage Tracking Tables
-- ============================================================
-- api_usage_log  : 상세 요청 로그 (endpoint, status, latency)
-- api_usage_daily: 날짜별 집계 (quota 계산용)
-- increment_usage_daily: atomic upsert RPC
-- ============================================================

-- 1. 상세 로그 테이블
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  method      text        NOT NULL DEFAULT 'GET',
  status_code smallint    NOT NULL,
  latency_ms  integer,
  plan        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_log_user_created
  ON public.api_usage_log (user_id, created_at DESC);

-- 2. 날짜별 집계 테이블 (quota 검사용)
CREATE TABLE IF NOT EXISTS public.api_usage_daily (
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date    NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS api_usage_daily_user_date
  ON public.api_usage_daily (user_id, date DESC);

-- 3. Atomic increment RPC
CREATE OR REPLACE FUNCTION public.increment_usage_daily(
  p_user_id uuid,
  p_date    date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_usage_daily (user_id, date, call_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET call_count = api_usage_daily.call_count + 1;
END;
$$;

-- 4. RLS 활성화
ALTER TABLE public.api_usage_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_daily ENABLE ROW LEVEL SECURITY;

-- 유저는 본인 데이터만 조회 가능
CREATE POLICY "users_see_own_usage_log"
  ON public.api_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_see_own_daily_usage"
  ON public.api_usage_daily FOR SELECT
  USING (auth.uid() = user_id);

-- service role은 모든 작업 가능 (로깅용)
CREATE POLICY "service_insert_usage_log"
  ON public.api_usage_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_upsert_daily_usage"
  ON public.api_usage_daily FOR ALL
  USING (true) WITH CHECK (true);
