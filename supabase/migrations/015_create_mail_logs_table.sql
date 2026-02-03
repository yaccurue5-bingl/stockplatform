-- Create mail_logs table for tracking email history
CREATE TABLE IF NOT EXISTS public.mail_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resend_id TEXT,                          -- Resend에서 반환한 메시지 ID
    recipient TEXT NOT NULL,                  -- 받는 사람 이메일
    subject TEXT,                             -- 이메일 제목
    mail_type TEXT DEFAULT 'general',         -- 메일 유형: general, waitlist_notify, disclosure_alert 등
    corp_name TEXT,                           -- 관련 종목명 (공시 알림 등)
    stock_code TEXT,                          -- 관련 종목코드
    sector TEXT,                              -- 관련 섹터
    status TEXT DEFAULT 'sent',               -- 상태: sent, delivered, bounced, failed
    error_message TEXT,                       -- 실패 시 에러 메시지
    metadata JSONB DEFAULT '{}',              -- 추가 정보 (유연한 확장용)
    created_at TIMESTAMPTZ DEFAULT NOW(),     -- 발송 시간
    updated_at TIMESTAMPTZ DEFAULT NOW()      -- 상태 업데이트 시간
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_mail_logs_recipient ON public.mail_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_mail_logs_resend_id ON public.mail_logs(resend_id);
CREATE INDEX IF NOT EXISTS idx_mail_logs_status ON public.mail_logs(status);
CREATE INDEX IF NOT EXISTS idx_mail_logs_mail_type ON public.mail_logs(mail_type);
CREATE INDEX IF NOT EXISTS idx_mail_logs_created_at ON public.mail_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_logs_corp_name ON public.mail_logs(corp_name) WHERE corp_name IS NOT NULL;

-- RLS 활성화
ALTER TABLE public.mail_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: service_role만 전체 액세스 (관리자 전용 테이블)
CREATE POLICY "Service role full access to mail_logs"
ON public.mail_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_mail_logs_updated_at
    BEFORE UPDATE ON public.mail_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명
COMMENT ON TABLE public.mail_logs IS 'Email sending history and tracking';
COMMENT ON COLUMN public.mail_logs.mail_type IS 'Type: general, waitlist_notify, disclosure_alert, weekly_digest';
COMMENT ON COLUMN public.mail_logs.status IS 'Status: sent, delivered, bounced, failed, opened, clicked';
