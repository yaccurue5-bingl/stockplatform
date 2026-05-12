-- Daily Digest 이메일 수신 거부 플래그
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS digest_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.digest_unsubscribed
  IS 'TRUE이면 Daily Digest 이메일 수신 거부. 기본값 FALSE(수신).';
