-- 048_create_bookmarks_table.sql
-- 사용자 공시 북마크 테이블

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disclosure_id  UUID NOT NULL REFERENCES public.disclosure_insights(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, disclosure_id)
);

-- RLS 활성화
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 자신의 북마크만 읽기
CREATE POLICY "User read own bookmarks" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);

-- 자신의 북마크 추가
CREATE POLICY "User insert own bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 자신의 북마크 삭제
CREATE POLICY "User delete own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- 조회 성능 인덱스 (최신순)
CREATE INDEX IF NOT EXISTS idx_bookmarks_user
  ON public.bookmarks (user_id, created_at DESC);
