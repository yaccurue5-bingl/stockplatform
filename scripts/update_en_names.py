import os
import requests
import time
import logging
from pathlib import Path
from scripts.industry_classifier.dart_db_client import DARTDBClient

# 프로젝트 루트의 .env.local을 로드하기 위한 설정
# (기존에 사용하시던 env_loader가 있다면 그것을 활용합니다)
from utils.env_loader import load_env

# 환경 변수 로드 (.env.local 포함)
load_env()

# 로그 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_corp_en_name(corp_name, service_key):
    """금융위원회 기업기본정보 API에서 corpEnsnNm(영문명) 추출"""
    url = 'http://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2'
    params = {
        'serviceKey': service_key,
        'pageNo': '1',
        'numOfRows': '1',
        'resultType': 'json',
        'corpNm': corp_name 
    }
    
    try:
        # 인증키가 인코딩된 상태이므로 requests가 다시 인코딩하지 않도록 조심해야 함
        # 일반적인 경우 아래와 같이 처리합니다.
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        items = data.get('response', {}).get('body', {}).get('items', {}).get('item', [])
        
        if items:
            return items[0].get('corpEnsnNm', '').strip()
    except Exception as e:
        logger.error(f"❌ API 호출 에러 ({corp_name}): {e}")
    return None

def main():
    # 1. 환경 변수에서 서비스키 가져오기
    SERVICE_KEY = os.getenv('PUBLIC_DATA_API_KEY')
    
    if not SERVICE_KEY:
        logger.error("❌ .env.local 파일에서 PUBLIC_DATA_API_KEY를 찾을 수 없습니다.")
        return

    db = DARTDBClient()
    
    # 2. dart_corp_codes 테이블에서 영문명이 null인 상장사 조회
    try:
        companies = db.supabase.table("dart_corp_codes") \
            .select("corp_name, stock_code") \
            .is_("corp_name_en", "null") \
            .not_.is_("stock_code", "null") \
            .execute()
    except Exception as e:
        logger.error(f"DB 조회 실패: {e}")
        return

    logger.info(f"🚀 업데이트 대상: {len(companies.data)}건")

    for item in companies.data:
        corp_name = item['corp_name']
        stock_code = item['stock_code']
        
        # 3. 영문명 조회
        en_name = get_corp_en_name(corp_name, SERVICE_KEY)
        
        if en_name:
            # 4. DB 업데이트
            try:
                db.supabase.table("dart_corp_codes") \
                    .update({"corp_name_en": en_name}) \
                    .eq("stock_code", stock_code) \
                    .execute()
                logger.info(f"✅ {corp_name} ({stock_code}) -> {en_name}")
            except Exception as e:
                logger.error(f"❌ DB 업데이트 실패 ({corp_name}): {e}")
        else:
            logger.warning(f"⚠️ {corp_name}: 영문명을 찾을 수 없음 (API 응답 없음)")
        
        # API 과부하 방지 (초당 호출 제한 준수)
        time.sleep(0.3)

if __name__ == "__main__":
    main()