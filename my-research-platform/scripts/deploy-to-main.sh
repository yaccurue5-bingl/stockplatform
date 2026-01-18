#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main 브랜치로 배포 (Vercel Webhook 연동용)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Main 브랜치 배포 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 현재 브랜치: $CURRENT_BRANCH"

# Main 브랜치로 전환
echo ""
echo "🔄 Main 브랜치로 전환 중..."
git checkout main

# Main 브랜치 상태 확인
echo ""
echo "📊 Main 브랜치 상태:"
git status

# 원격과의 차이 확인
AHEAD=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "0")
BEHIND=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")

echo ""
echo "📈 원격 저장소와의 차이:"
echo "   앞선 커밋: $AHEAD"
echo "   뒤처진 커밋: $BEHIND"

if [ "$AHEAD" -gt 0 ]; then
  echo ""
  echo "✅ 로컬에 새 커밋이 있습니다. Push가 필요합니다."
  echo ""
  echo "최근 커밋 목록:"
  git log origin/main..HEAD --oneline | head -10

  echo ""
  read -p "🚀 원격 main 브랜치로 push하시겠습니까? (y/N): " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📤 Push 중..."
    git push origin main

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Main 브랜치 Push 완료!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "다음 단계:"
    echo "1. Vercel Dashboard에서 자동 배포 확인"
    echo "2. 배포 완료 후 Supabase Webhook 테스트"
    echo "3. k-marketinsight.com 접속하여 확인"
    echo ""
  else
    echo ""
    echo "❌ Push 취소됨"
  fi
elif [ "$BEHIND" -gt 0 ]; then
  echo ""
  echo "⚠️ 원격 브랜치가 앞서 있습니다. Pull이 필요합니다."
  echo ""
  read -p "🔄 원격 main 브랜치를 pull하시겠습니까? (y/N): " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📥 Pull 중..."
    git pull origin main
    echo "✅ Pull 완료"
  fi
else
  echo ""
  echo "✅ 로컬과 원격이 동일합니다. 추가 작업이 필요 없습니다."
fi

# 원래 브랜치로 돌아가기
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo ""
  read -p "🔙 원래 브랜치($CURRENT_BRANCH)로 돌아가시겠습니까? (Y/n): " -n 1 -r
  echo

  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    git checkout "$CURRENT_BRANCH"
    echo "✅ $CURRENT_BRANCH 브랜치로 복귀"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
