import os
import requests
import re
import time
import logging
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
import urllib3

# SSL 경고 비활성화 및 로깅 설정
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 환경 변수 로드 (경로는 본인 환경에 맞게 수정)
load_dotenv(r"C:\stockplatform\.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DART_API_KEY = os.environ.get("DART_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_clean_content(rcept_no):
    """DART API를 통해 본문 추출 및 정제"""
    url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_API_KEY}&rcept_no={rcept_no}"
    try:
        response = requests.get(url, verify=False, timeout=20)
        if response.status_code == 200:
            # HTML/XML 태그 제거
            text = re.sub(r'<[^>]*>', '', response.text)
            # 연속된 공백 및 줄바꿈 정리
            text = re.sub(r'\s+', ' ', text).strip()
            # AI 분석에 최적화된 길이로 슬라이싱 (추후 토큰 절약)
            return text[:2500]
    except Exception as e:
        logger.error(f"❌ 본문 수집 실패 ({rcept_no}): {e}")
    return None

def update_existing_data():
    logger.info("🚀 기존 데이터 본문 채우기 시작...")
    
    # 1. content가 null인 데이터 가져오기 (배치 단위로 처리)
    while True:
        res = supabase.table("disclosure_insights") \
            .select("id, rcept_no, corp_name") \
            .is_("content", "null") \
            .limit(50) \
            .execute()
        
        items = res.data
        if not items:
            logger.info("✅ 모든 데이터의 본문이 채워졌습니다.")
            break
            
        for item in items:
            rcept_no = item['rcept_no']
            corp_name = item['corp_name']
            
            content = get_clean_content(rcept_no)
            
            if content:
                # 2. DB 업데이트
                supabase.table("disclosure_insights") \
                    .update({"content": content}) \
                    .eq("id", item['id']) \
                    .execute()
                logger.info(f"✔️ 업데이트 완료: {corp_name} ({rcept_no})")
            
            # DART API 속도 제한 고려 (약간의 지연)
            time.sleep(0.2)

if __name__ == "__main__":
    if not DART_API_KEY:
        logger.error("❌ DART_API_KEY가 설정되지 않았습니다.")
    else:
        update_existing_data()