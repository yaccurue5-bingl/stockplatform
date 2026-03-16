-- migration 020: users 테이블 B2B API 키 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_api_key ON public.users(api_key)
  WHERE api_key IS NOT NULL;

COMMENT ON COLUMN public.users.api_key IS 'B2B API 접근용 API 키 (UUID 형식 권장)';
