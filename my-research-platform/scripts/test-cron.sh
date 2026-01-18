#!/bin/bash

# Test Cron Job Script
# 공시 분석 cron을 수동으로 실행하여 테스트

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  K-MarketInsight Cron Test Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 환경 확인
if [ -f ".env.local" ]; then
  source .env.local
  echo -e "${GREEN}✅ .env.local loaded${NC}"
else
  echo -e "${RED}❌ .env.local not found${NC}"
  echo -e "${YELLOW}Run: vercel env pull .env.local${NC}"
  exit 1
fi

# CRON_SECRET_TOKEN 확인
if [ -z "$CRON_SECRET_TOKEN" ]; then
  echo -e "${RED}❌ CRON_SECRET_TOKEN not set${NC}"
  echo -e "${YELLOW}Add CRON_SECRET_TOKEN to Vercel environment variables${NC}"
  exit 1
fi

echo -e "${GREEN}✅ CRON_SECRET_TOKEN found${NC}"
echo ""

# 배포 URL 확인
if [ -z "$1" ]; then
  DEPLOY_URL="https://k-marketinsight.com"
  echo -e "${YELLOW}Using production URL: ${DEPLOY_URL}${NC}"
else
  DEPLOY_URL="$1"
  echo -e "${BLUE}Using custom URL: ${DEPLOY_URL}${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Testing: analyze-disclosures${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Cron 실행
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "${DEPLOY_URL}/api/cron/analyze-disclosures" \
  -H "Authorization: Bearer ${CRON_SECRET_TOKEN}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "HTTP Status: ${HTTP_CODE}"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Cron executed successfully!${NC}"
  echo ""
  echo -e "${BLUE}Response:${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Cron execution failed${NC}"
  echo ""
  echo -e "${RED}Response:${NC}"
  echo "$BODY"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Test completed${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
