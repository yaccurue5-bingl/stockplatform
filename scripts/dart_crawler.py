import os
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client
import urllib3
import logging
import hashlib
import re
import zipfile
import io

# SSL 경고 비활성화
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") # URL 환경변수 사용 권장
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def generate_hash_key(corp_code: str, rcept_no: str) -> str:
    """공시 hash key 생성"""
    return hashlib.sha256(f"{corp_code}_{rcept_no}".encode()).hexdigest()

def is_disclosure_processed(corp_code: str, rcept_no: str) -> bool:
    """이미 처리된 공시인지 확인"""
    try:
        hash_key = generate_hash_key(corp_code, rcept_no)
        result = supabase.table("disclosure_hashes") \
            .select("id") \
            .eq("hash_key", hash_key) \
            .gt("expires_at", datetime.now().isoformat()) \
            .execute()
        return len(result.data) > 0
    except Exception as e:
        logger.warning(f"해시 확인 실패 (처리 진행): {e}")
        return False

def get_clean_content(rcept_no):
    """ZIP 압축 해제 및 정밀 정제 로직 통합"""
    dart_key = os.environ.get("DART_API_KEY")
    if not dart_key:
        return None
        
    content_url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={dart_key}&rcept_no={rcept_no}"
    
    try:
        response = requests.get(content_url, verify=False, timeout=30)
        if response.status_code == 200:
            # 1. ZIP 파일 여부 확인
            if response.content.startswith(b'PK'):
                with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                    xml_name = z.namelist()[0]
                    with z.open(xml_name) as f:
                        raw_text = f.read().decode('utf-8')
                
                # 2. 정밀 정제 로직 (Style, Script 제거)
                clean_text = re.sub(r'<(style|script)[^>]*>.*?</\1>', '', raw_text, flags=re.DOTALL | re.IGNORECASE)
                clean_text = re.sub(r'<[^>]*>', '', clean_text)
                clean_text = clean_text.replace('\x00', '').replace('\u0000', '')
                clean_text = re.sub(r'\s+', ' ', clean_text).strip()
                
                return clean_text[:2500]
            else:
                # 3. ZIP이 아닌 경우 (에러 013, 014 등)
                logger.warning(f"⚠️ {rcept_no} 수집 불가 (DART 메시지: {response.text[:50]})")
                return "CONTENT_NOT_AVAILABLE"
    except Exception as e:
        logger.warning(f"⚠️ 본문 수집 실패 ({rcept_no}): {e}")
    return None

def run_crawler():
    today = datetime.now().strftime('%Y%m%d')
    dart_key = os.environ.get("DART_API_KEY")
    api_url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={dart_key}&bgnde={today}&endde={today}&page_count=100"

    logger.info(f"📡 DART 데이터 수집 시작: {today}")

    # ... (데이터 호출부 생략) ...
    try:
        res = requests.get(api_url, verify=False, timeout=30)
        data = res.json()
    except Exception as e:
        logger.error(f"❌ DART API 호출 실패: {e}")
        return

    if data.get("status") == "000":
        count = 0
        for item in data.get("list", []):
            # ... (중복 체크 및 데이터 정리 생략) ...
            rcept_no = item.get("rcept_no")
            corp_code = item.get("corp_code", "").strip()
            
            if not corp_code or is_disclosure_processed(corp_code, rcept_no):
                continue
            
            # ✅ 정제된 본문 추출 함수 호출
            content = get_clean_content(rcept_no)
            
            payload = {
                "rcept_no": rcept_no,
                "corp_code": corp_code,
                "corp_name": item.get("corp_name"),
                "stock_code": item.get("stock_code", "").strip(),
                "rcept_dt": item.get("rcept_dt"),
                "report_nm": item.get("report_nm"),
                "content": content, # 정제된 텍스트 또는 마킹값
                "analysis_status": "pending",
                "created_at": datetime.now().isoformat()
            }

            try:
                supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()
                # (해시 기록 로직 생략)
                count += 1
                logger.info(f"✅ [{count}] {item.get('corp_name')} 저장 완료")
            except Exception as e:
                logger.error(f"❌ DB 저장 실패: {e}")

if __name__ == "__main__":
    run_crawler()