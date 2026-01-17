#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cron Job 수동 실행 스크립트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# 환경변수 로드
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# 배포 URL 확인
if [ -z "$DEPLOY_URL" ]; then
  echo "❌ DEPLOY_URL이 설정되지 않았습니다."
  echo "   .env.local에 DEPLOY_URL=https://k-marketinsight.com 추가하세요"
  exit 1
fi

# Cron Secret 확인
if [ -z "$CRON_SECRET_TOKEN" ]; then
  echo "❌ CRON_SECRET_TOKEN이 설정되지 않았습니다."
  echo "   .env.local에 CRON_SECRET_TOKEN=your-secret-token 추가하세요"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Cron Job 수동 실행 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Target: $DEPLOY_URL/api/cron/analyze-disclosures"
echo "⏰ Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Cron Job 실행
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "${DEPLOY_URL}/api/cron/analyze-disclosures" \
  -H "Authorization: Bearer ${CRON_SECRET_TOKEN}" \
  -H "Content-Type: application/json")

# HTTP 상태 코드 추출
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 응답 결과"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ 성공 (HTTP $HTTP_CODE)"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

  # 주요 지표 추출
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📈 요약"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if command -v jq &> /dev/null; then
    TOTAL=$(echo "$BODY" | jq -r '.totalDisclosures // 0')
    NEW=$(echo "$BODY" | jq -r '.newDisclosures // 0')
    ANALYZED=$(echo "$BODY" | jq -r '.successCount // 0')
    FAILED=$(echo "$BODY" | jq -r '.failedCount // 0')
    SONNET=$(echo "$BODY" | jq -r '.sonnetAnalyzed // 0')

    echo "• 전체 공시: $TOTAL 건"
    echo "• 새 공시: $NEW 건"
    echo "• 분석 성공: $ANALYZED 건"
    echo "• 분석 실패: $FAILED 건"
    echo "• Sonnet 분석: $SONNET 건"
  fi

  echo ""
  echo "✅ Cron Job 실행 완료!"
  echo ""
  echo "다음 단계:"
  echo "1. Supabase Dashboard → SQL Editor"
  echo "2. supabase/monitor_disclosures.sql 실행"
  echo "3. 크롤링 결과 확인"

else
  echo "❌ 실패 (HTTP $HTTP_CODE)"
  echo ""
  echo "$BODY"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔧 문제 해결"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ "$HTTP_CODE" -eq 401 ]; then
    echo "❌ 인증 실패"
    echo "   CRON_SECRET_TOKEN이 올바른지 확인하세요"
  elif [ "$HTTP_CODE" -eq 500 ]; then
    echo "❌ 서버 에러"
    echo "   Vercel 로그 확인: vercel logs --since 10m"
  else
    echo "❌ 알 수 없는 에러 (HTTP $HTTP_CODE)"
    echo "   네트워크 연결 또는 URL을 확인하세요"
  fi

  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
