-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 크롤링 결과 모니터링
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 이 쿼리를 주기적으로 실행하여 크롤링 상태를 확인하세요
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. 전체 공시 개수 및 통계
SELECT
  '📊 전체 통계' as category,
  COUNT(*) as total_disclosures,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_1h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE analysis_status = 'completed') as analyzed,
  COUNT(*) FILTER (WHERE analysis_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE analysis_status = 'failed') as failed,
  COUNT(*) FILTER (WHERE sonnet_analyzed = TRUE) as sonnet_analyzed,
  COUNT(*) FILTER (WHERE is_sample_disclosure = TRUE) as sample_count,
  MIN(created_at) as oldest_disclosure,
  MAX(created_at) as newest_disclosure
FROM disclosure_insights;

-- 2. 시간대별 크롤링 현황 (최근 24시간)
SELECT
  '⏰ 시간대별 현황' as category,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as disclosure_count,
  COUNT(DISTINCT corp_name) as unique_companies,
  COUNT(*) FILTER (WHERE importance = 'HIGH') as high_importance,
  COUNT(*) FILTER (WHERE importance = 'MEDIUM') as medium_importance,
  COUNT(*) FILTER (WHERE importance = 'LOW') as low_importance
FROM disclosure_insights
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 3. 최근 15분 크롤링 (마지막 Cron 실행 결과)
SELECT
  '🔥 최근 15분' as category,
  COUNT(*) as new_disclosures,
  COUNT(DISTINCT corp_name) as companies,
  COUNT(*) FILTER (WHERE importance = 'HIGH') as high_importance,
  STRING_AGG(DISTINCT corp_name, ', ' ORDER BY corp_name) as company_list
FROM disclosure_insights
WHERE created_at >= NOW() - INTERVAL '15 minutes';

-- 4. 종목별 공시 현황 (상위 20개)
SELECT
  '📈 종목별 공시 수' as category,
  corp_name,
  stock_code,
  COUNT(*) as disclosure_count,
  COUNT(*) FILTER (WHERE importance = 'HIGH') as high_importance_count,
  MAX(created_at) as latest_disclosure,
  COUNT(*) FILTER (WHERE sonnet_analyzed = TRUE) as sonnet_count
FROM disclosure_insights
GROUP BY corp_name, stock_code
ORDER BY disclosure_count DESC
LIMIT 20;

-- 5. 분석 상태별 현황
SELECT
  '🤖 분석 상태' as category,
  analysis_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM disclosure_insights
GROUP BY analysis_status
ORDER BY count DESC;

-- 6. 중요도별 분포
SELECT
  '⭐ 중요도 분포' as category,
  importance,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM disclosure_insights
WHERE importance IS NOT NULL
GROUP BY importance
ORDER BY
  CASE importance
    WHEN 'HIGH' THEN 1
    WHEN 'MEDIUM' THEN 2
    WHEN 'LOW' THEN 3
  END;

-- 7. 감정 분석 분포
SELECT
  '😊 감정 분석' as category,
  sentiment,
  COUNT(*) as count,
  ROUND(AVG(sentiment_score), 2) as avg_score,
  MIN(sentiment_score) as min_score,
  MAX(sentiment_score) as max_score
FROM disclosure_insights
WHERE sentiment IS NOT NULL
GROUP BY sentiment
ORDER BY count DESC;

-- 8. Sonnet 샘플 분석 현황
SELECT
  '🎯 Sonnet 샘플' as category,
  corp_name,
  report_nm,
  importance,
  sentiment,
  sonnet_analyzed_at,
  SUBSTRING(sonnet_summary, 1, 100) || '...' as summary_preview
FROM disclosure_insights
WHERE is_sample_disclosure = TRUE
ORDER BY sonnet_analyzed_at DESC
LIMIT 5;

-- 9. 최근 공시 목록 (최신 10개)
SELECT
  '📰 최신 공시' as category,
  corp_name,
  stock_code,
  report_nm,
  importance,
  analysis_status,
  created_at
FROM disclosure_insights
ORDER BY created_at DESC
LIMIT 10;

-- 10. 분석 실패 목록 (디버깅용)
SELECT
  '❌ 분석 실패' as category,
  corp_name,
  report_nm,
  created_at,
  analyzed_at
FROM disclosure_insights
WHERE analysis_status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 11. Hash 테이블 통계 (중복 방지 확인)
SELECT
  '🔐 Hash 통계' as category,
  COUNT(*) as total_hashes,
  COUNT(*) FILTER (WHERE groq_analyzed = TRUE) as groq_analyzed,
  COUNT(*) FILTER (WHERE sonnet_analyzed = TRUE) as sonnet_analyzed,
  COUNT(*) FILTER (WHERE is_revision = TRUE) as revisions,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_hashes
FROM disclosure_hashes;

-- 12. Hot Stocks 현황
SELECT
  '🔥 Hot Stocks' as category,
  corp_name,
  stock_code,
  reason,
  promoted_at,
  expires_at,
  refresh_count
FROM hot_stocks
WHERE is_active = TRUE
  AND expires_at > NOW()
ORDER BY promoted_at DESC;

-- 13. 간단 요약 (복사해서 보고용)
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as summary,
  CONCAT(
    '총 공시: ', COUNT(*), '건',
    ' | 오늘: ', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE), '건',
    ' | 분석완료: ', COUNT(*) FILTER (WHERE analysis_status = 'completed'), '건',
    ' | 대기중: ', COUNT(*) FILTER (WHERE analysis_status = 'pending'), '건',
    ' | Sonnet: ', COUNT(*) FILTER (WHERE sonnet_analyzed = TRUE), '건'
  ) as statistics
FROM disclosure_insights;
