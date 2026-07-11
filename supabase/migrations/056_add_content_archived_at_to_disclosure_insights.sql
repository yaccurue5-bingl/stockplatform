-- 056_add_content_archived_at_to_disclosure_insights.sql
-- content 컬럼(DART 원문)을 Supabase Storage로 백업 후 null 처리하는 배치용 추적 컬럼.
-- (예전엔 일회성으로 전체 백업+null 처리했었는데, 이후 분석 완료된 신규 행에 content가
--  다시 계속 쌓이고 있어서 상시 배치로 전환 — scripts/archive_disclosure_content.py)

ALTER TABLE public.disclosure_insights
  ADD COLUMN IF NOT EXISTS content_archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.disclosure_insights.content_archived_at
  IS 'content를 Storage(disclosure-content-archive 버킷, {id}.txt)로 백업하고 null 처리한 시각. '
     'NULL이면 아직 백업 안 됐거나(content 있음) 애초에 content를 가져온 적이 없음(content 없음) — '
     '구분은 content IS NULL 여부로 판단.';

-- 백업 대상(analysis_status 종료 상태 + content 있음 + 아직 미백업) 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_content_archive_queue
  ON public.disclosure_insights (updated_at)
  WHERE content_archived_at IS NULL
    AND content IS NOT NULL
    AND analysis_status IN ('completed', 'low_quality');
