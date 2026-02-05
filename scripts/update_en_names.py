import os
import time
import logging
import requests
from scripts.industry_classifier.dart_db_client import DARTDBClient
from utils.env_loader import load_env

# 환경 변수 로드 (.env.local 포함)
load_env()

# 로그 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_en_name_from_dart(corp_code, api_key):
    """
    DART 고유번호(corp_code)를 사용하여 기업개황 API에서 
    정확한 영문 법인명(corp_name_eng)을 가져옵니다.
    """
    url = "https://opendart.fss.or.kr/api/company.json"
    params = {
        'crtfc_key': api_key,
        'corp_code': corp_code
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == '000':
                return data.get('corp_name_eng', '').strip()
            else:
                logger.warning(f"⚠️ DART API 응답 에러 ({corp_code}): {data.get('message')}")
    except Exception as e:
        logger.error(f"❌ API 호출 실패 ({corp_code}): {e}")
    return None

def main():
    # 1. 환경 변수에서 DART API KEY 가져오기
    # (.env.local에 DART_API_KEY 또는 이와 유사한 이름으로 저장되어 있어야 합니다)
    DART_API_KEY = os.getenv('DART_API_KEY')
    
    if not DART_API_KEY:
        logger.error("❌ .env.local 파일에서 DART_API_KEY를 찾을 수 없습니다.")
        return

    db = DARTDBClient()
    
    # 2. DB에서 영문명이 없고 종목코드가 있는 기업들 조회 (실패했던 627건 포함)
    try:
        # stock_code가 있는 상장사 중 영문명이 없는 것만 추출
        companies = db.supabase.table("dart_corp_codes") \
            .select("corp_code, corp_name, stock_code") \
            .is_("corp_name_en", "null") \
            .not_.is_("stock_code", "null") \
            .execute()
    except Exception as e:
        logger.error(f"DB 조회 실패: {e}")
        return

    target_list = companies.data
    logger.info(f"🚀 총 {len(target_list)}건의 영문명 업데이트를 시작합니다.")

    success_count = 0
    for item in target_list:
        corp_code = item['corp_code']
        corp_name = item['corp_name']
        
        # 3. DART API로 정확한 영문명 가져오기
        en_name = get_en_name_from_dart(corp_code, DART_API_KEY)
        
        if en_name:
            # 4. DB 업데이트
            try:
                db.supabase.table("dart_corp_codes") \
                    .update({"corp_name_en": en_name}) \
                    .eq("corp_code", corp_code) \
                    .execute()
                logger.info(f"✅ [{success_count+1}] {corp_name} -> {en_name}")
                success_count += 1
            except Exception as e:
                logger.error(f"❌ DB 저장 실패 ({corp_name}): {e}")
        else:
            logger.warning(f"⚠️ {corp_name}: 영문명을 찾을 수 없음")
        
        # DART API 호출 제한 준수 (분당 1,000건 미만 권장)
        time.sleep(0.05) 

    logger.info(f"🎉 업데이트 완료! (성공: {success_count} / 대상: {len(target_list)})")

if __name__ == "__main__":
    main()