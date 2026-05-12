-- ============================================================
-- 044_reclassify_buyback_disposal.sql
-- disclosure_insights 이벤트 유형 재분류
--
-- 배경:
--   자기주식 처분(disposal)은 회사가 보유 자기주식을 시장에 매도하는 것으로
--   주식 공급 증가 → BEARISH 신호임에도 BUYBACK으로 잘못 분류됨.
--   이를 별도 DISPOSAL 유형으로 분리하여 신호 품질 향상.
--
-- 분류 기준:
--   BUYBACK  : 자기주식 취득(매입) 또는 소각 결정 → 주주 환원 (BULLISH)
--   DISPOSAL : 자기주식 처분 결정 → 주식 공급 증가 (BEARISH)
-- ============================================================

UPDATE public.disclosure_insights
SET event_type = 'DISPOSAL',
    updated_at = NOW()
WHERE event_type = 'BUYBACK'
  AND (report_nm ILIKE '%disposal%' OR report_nm LIKE '%처분%');

-- 결과 확인용 (적용 후 삭제하지 않아도 무방)
-- SELECT event_type, COUNT(*) FROM public.disclosure_insights
-- WHERE event_type IN ('BUYBACK', 'DISPOSAL')
-- GROUP BY event_type;
-- Expected: BUYBACK ~638, DISPOSAL ~263
