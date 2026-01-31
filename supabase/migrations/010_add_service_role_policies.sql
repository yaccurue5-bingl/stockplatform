-- =========================================
-- Service Role 전체 액세스 정책 추가
-- =========================================
-- Service Role은 RLS를 우회하고 모든 데이터에 접근할 수 있도록 설정

-- 1. sectors 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on sectors" ON public.sectors;

CREATE POLICY "Service role can do anything on sectors"
  ON public.sectors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. companies 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on companies" ON public.companies;

CREATE POLICY "Service role can do anything on companies"
  ON public.companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. disclosure_insights 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on disclosure_insights" ON public.disclosure_insights;

CREATE POLICY "Service role can do anything on disclosure_insights"
  ON public.disclosure_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. market_indices 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on market_indices" ON public.market_indices;

CREATE POLICY "Service role can do anything on market_indices"
  ON public.market_indices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. users 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on users" ON public.users;

CREATE POLICY "Service role can do anything on users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================
-- 완료
-- =========================================
-- Service Role이 모든 테이블에 전체 액세스할 수 있습니다.
