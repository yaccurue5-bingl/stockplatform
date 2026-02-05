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
        response = requests.get(url, timeout=10)
        data = response.json()
        
        # DART API 정상 응답 코드 '000'
        if data.get('status') == '000':
            return data.get('corp_name_eng', '').strip()
        else:
            print(f"⚠️ DART API 응답 에러 ({corp_code}): {data.get('message')}")
    except Exception as e:
        print(f"❌ API 호출 실패: {e}")
    return None

def main():
    # .env.local에 저장된 DART_API_KEY를 사용하세요
    DART_API_KEY = os.getenv('DART_API_KEY') 
    db = DARTDBClient()
    
    # 1. 영문명이 없고 종목코드가 있는 기업들 조회
    companies = db.supabase.table("dart_corp_codes") \
        .select("corp_code, corp_name, stock_code") \
        .is_("corp_name_en", "null") \
        .not_.is_("stock_code", "null") \
        .execute()

    for item in companies.data:
        corp_code = item['corp_code']
        corp_name = item['corp_name']
        
        # DART API로 정확한 영문명 가져오기
        en_name = get_corp_en_name(corp_code, DART_API_KEY)
        
        if en_name:
            # DB 업데이트
            db.supabase.table("dart_corp_codes") \
                .update({"corp_name_en": en_name}) \
                .eq("corp_code", corp_code) \
                .execute()
            print(f"✅ {corp_name} -> {en_name}")
        
        time.sleep(0.1) # DART API 초당 호출 제한 준수

if __name__ == "__main__":
    main()