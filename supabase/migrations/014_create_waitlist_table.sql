-- Create waitlist table for collecting emails before launch
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'website',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    subscribed BOOLEAN DEFAULT true
);

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);

-- Create index for notification status
CREATE INDEX IF NOT EXISTS idx_waitlist_notified ON public.waitlist(notified_at) WHERE notified_at IS NULL;

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Anonymous users can INSERT only (for signup)
-- 2. No SELECT/UPDATE/DELETE for anonymous users (protect email list)
-- 3. Service role has full access (for admin operations)

-- Allow anonymous users to insert (join waitlist)
CREATE POLICY "Allow anonymous insert to waitlist"
ON public.waitlist
FOR INSERT
TO anon
WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role full access to waitlist"
ON public.waitlist
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.waitlist IS 'Email waitlist for pre-launch signups';
