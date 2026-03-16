import os
import requests
import re
import zipfile
import io
import time
import logging
from supabase import create_client, Client
from dotenv import load_dotenv
import urllib3

# 설정 및 SSL 경고 비활성화
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 환경 변수 로드 (본인의 경로에 맞게 수정)
load_dotenv(r"C:\stockplatform\.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DART_API_KEY = os.environ.get("DART_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_final_content(rcept_no):
    """ZIP 해제, 스타일 제거, 유니코드 정제가 통합된 추출 함수"""
    url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_API_KEY}&rcept_no={rcept_no}"
    try:
        res = requests.get(url, verify=False, timeout=20)
        if res.status_code != 200:
            return None

        # 1. ZIP 파일 여부 확인
        if not res.content.startswith(b'PK'):
            # 에러 메시지(013, 014 등)인 경우 로그 출력 후 None 반환
            error_msg = res.text[:100].strip()
            logger.warning(f"⚠️ {rcept_no} 수집 불가 (DART 메시지: {error_msg})")
            return None

        # 2. 압축 해제 및 텍스트 추출
        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            xml_name = z.namelist()[0]
            with z.open(xml_name) as f:
                raw_text = f.read().decode('utf-8')

        # 3. 텍스트 정제
        # <style> 및 <script> 태그 내부 내용 통째로 삭제
        clean_text = re.sub(r'<(style|script)[^>]*>.*?</\1>', '', raw_text, flags=re.DOTALL | re.IGNORECASE)
        # 모든 HTML/XML 태그 제거
        clean_text = re.sub(r'<[^>]*>', '', clean_text)
        # .xforms { ... } 같은 잔여 스타일 코드 제거
        clean_text = re.sub(r'\.[a-zA-Z0-9_]+\s*\{[^}]*\}', '', clean_text)
        # 유령 문자 및 연속 공백 정리
        clean_text = clean_content = clean_text.replace('\x00', '').replace('\u0000', '')
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        
        return clean_text[:2500]
        
    except Exception as e:
        logger.error(f"❌ {rcept_no} 처리 중 예외: {str(e)}")
    return None

def update_all():
    logger.info("🚀 공시 본문 업데이트 및 마킹 작업을 시작합니다.")
    
    while True:
        # content가 비어있는 데이터만 20개씩 가져옴
        res = supabase.table("disclosure_insights") \
            .select("id, rcept_no, corp_name") \
            .is_("content", "null") \
            .limit(20) \
            .execute()
        
        items = res.data
        if not items:
            logger.info("✅ 모든 공시 본문 처리가 완료되었습니다.")
            break
            
        for item in items:
            content = get_final_content(item['rcept_no'])
            
            if content:
                # 정상 수집 성공 시 본문 저장
                supabase.table("disclosure_insights") \
                    .update({"content": content}) \
                    .eq("id", item['id']).execute()
                logger.info(f"✔️ 성공: {item['corp_name']} ({item['rcept_no']})")
            else:
                # 수집 실패 시(013, 014 등) 마킹 처리하여 재수집 대상에서 제외
                supabase.table("disclosure_insights") \
                    .update({"content": "CONTENT_NOT_AVAILABLE"}) \
                    .eq("id", item['id']).execute()
                logger.warning(f"⚠️ 마킹 (수집불가): {item['corp_name']}")
            
            time.sleep(0.3) # API 제한 준수

if __name__ == "__main__":
    if not DART_API_KEY:
        logger.error("DART_API_KEY가 없습니다.")
    else:
        update_all()