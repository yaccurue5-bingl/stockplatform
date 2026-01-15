-- =========================================
-- K-MarketInsight MVP Database Schema
-- =========================================

-- 1. users 테이블 (Supabase Auth 확장)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. companies 테이블 (KRX 종목 정보)
CREATE TABLE IF NOT EXISTS public.companies (
  code TEXT PRIMARY KEY,
  name_kr TEXT NOT NULL,
  name_en TEXT,
  market TEXT CHECK (market IN ('KOSPI', 'KOSDAQ')),
  sector TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. disclosure_insights 테이블 (DART 공시 AI 요약)
CREATE TABLE IF NOT EXISTS public.disclosure_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_code TEXT REFERENCES public.companies(code) ON DELETE CASCADE,
  title_kr TEXT NOT NULL,
  title_en TEXT,
  summary_kr TEXT,
  summary_en TEXT,
  sentiment TEXT CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. market_indices 테이블 (시장 지수)
CREATE TABLE IF NOT EXISTS public.market_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name TEXT NOT NULL,
  value NUMERIC,
  change_percent NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- RLS (Row Level Security) 설정
-- =========================================

-- users 테이블 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own email" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;

-- ✅ 사용자는 자기 자신의 데이터만 조회 가능
CREATE POLICY "Users can view their own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- ✅ 사용자는 자기 자신의 이메일만 업데이트 가능 (plan은 서버에서만 변경)
CREATE POLICY "Users can update their own email"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ✅ 회원가입 시 자동으로 users 레코드 생성 (Supabase Function에서 처리)
CREATE POLICY "Users can insert their own data"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- companies 테이블 RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;

-- ✅ 모든 로그인 사용자는 종목 정보 조회 가능 (읽기 전용)
CREATE POLICY "Authenticated users can view companies"
  ON public.companies
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- disclosure_insights 테이블 RLS
ALTER TABLE public.disclosure_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FREE users can view recent insights" ON public.disclosure_insights;

-- ✅ FREE 사용자는 최근 7일 데이터만 조회 가능
CREATE POLICY "FREE users can view recent insights"
  ON public.disclosure_insights
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- PRO 사용자는 모든 데이터 조회 가능
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.plan = 'PRO'
      )
      OR
      -- FREE 사용자는 최근 7일만
      (
        published_at >= NOW() - INTERVAL '7 days' AND
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid() AND users.plan = 'FREE'
        )
      )
    )
  );

-- market_indices 테이블 RLS
ALTER TABLE public.market_indices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view market indices" ON public.market_indices;

-- ✅ 모든 로그인 사용자는 시장 지수 조회 가능
CREATE POLICY "Authenticated users can view market indices"
  ON public.market_indices
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =========================================
-- 인덱스 (성능 최적화)
-- =========================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_company_code ON public.disclosure_insights(company_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_published_at ON public.disclosure_insights(published_at DESC);

-- =========================================
-- Functions & Triggers
-- =========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (재실행 시 충돌 방지)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;

-- users 테이블 updated_at 트리거
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- companies 테이블 updated_at 트리거
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 회원가입 시 자동으로 users 테이블에 레코드 생성
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, plan)
  VALUES (NEW.id, NEW.email, 'FREE');
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- 이미 존재하는 경우 무시
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- auth.users 테이블에 새 사용자 생성 시 트리거
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
