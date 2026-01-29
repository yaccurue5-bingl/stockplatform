#!/bin/bash
# 기업-KSIC 매핑 실행 스크립트
# 모든 기업의 sector를 한글 업종명으로 업데이트

echo "============================================================"
echo "기업-KSIC 자동 매핑"
echo "============================================================"
echo ""
echo "설정:"
echo "  - unmapped_only: False (모든 기업 업데이트)"
echo "  - batch_size: 50"
echo "  - verbose: True (상세 로그)"
echo ""
echo "주의: DART API rate limit으로 인해 시간이 오래 걸릴 수 있습니다."
echo "      (초당 1회 제한 = 약 2000개 기업 처리에 약 30분 소요)"
echo ""
read -p "계속하시겠습니까? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "취소되었습니다."
    exit 0
fi

echo ""
echo "매핑 시작..."
echo ""

# 스크립트 실행
python3 scripts/map_companies_to_ksic.py \
    --batch-size 50 \
    --verbose

echo ""
echo "============================================================"
echo "매핑 완료!"
echo "============================================================"
