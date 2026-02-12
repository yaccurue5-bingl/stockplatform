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
import xml.etree.ElementTree as ET

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
    """ZIP 압축 해제, 상세 에러 로깅 및 정밀 정제 로직 통합"""
    dart_key = os.environ.get("DART_API_KEY")
    if not dart_key:
        logger.error("❌ DART_API_KEY가 설정되지 않았습니다.")
        return None
        
    content_url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={dart_key}&rcept_no={rcept_no}"
    
    try:
        # verify=False는 SSL 인증서 오류 방지용 (필요시 사용)
        response = requests.get(content_url, verify=False, timeout=30)
        
        if response.status_code == 200:
            # 1. 정상적인 ZIP 파일 응답인 경우 (PK로 시작)
            if response.content.startswith(b'PK'):
                try:
                    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                        xml_name = z.namelist()[0]
                        with z.open(xml_name) as f:
                            # 다양한 인코딩 대응을 위해 errors='ignore' 추가
                            raw_text = f.read().decode('utf-8', errors='ignore')
                    
                    # 2. 정밀 정제 로직 (Style, Script 및 HTML 태그 제거)
                    clean_text = re.sub(r'<(style|script)[^>]*>.*?</\1>', '', raw_text, flags=re.DOTALL | re.IGNORECASE)
                    clean_text = re.sub(r'<[^>]*>', '', clean_text)
                    
                    # Null 바이트 및 특수 문자 제거
                    clean_text = clean_text.replace('\x00', '').replace('\u0000', '')
                    # 연속된 공백 하나로 통합
                    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
                    
                    return clean_text[:2500]  # DB 저장을 위해 길이 제한
                
                except Exception as zip_err:
                    logger.error(f"❌ ZIP 처리 중 오류 ({rcept_no}): {zip_err}")
                    return "CONTENT_NOT_AVAILABLE"

            # 3. ZIP이 아닌 경우 (DART 에러 XML 응답)
            else:
                response_text = response.text
                if "<?xml" in response_text:
                    try:
                        # XML을 파싱하여 정확한 DART 에러 메시지 추출
                        root = ET.fromstring(response_text)
                        status = root.find('status').text if root.find('status') is not None else "Unknown"
                        message = root.find('message').text if root.find('message') is not None else "No Message"
                        
                        logger.warning(f"⚠️ {rcept_no} 수집 불가 - DART 응답 [상태: {status}] [메시지: {message}]")
                    except Exception:
                        logger.warning(f"⚠️ {rcept_no} 수집 불가 (XML 파싱 실패: {response_text[:50]})")
                else:
                    logger.warning(f"⚠️ {rcept_no} 수집 불가 (알 수 없는 응답 형식)")
                
                # 요청하신 대로 수집 불가 시 해당 문구 반환
                return "CONTENT_NOT_AVAILABLE"

    except Exception as e:
        logger.warning(f"⚠️ 본문 수집 중 시스템 에러 발생 ({rcept_no}): {e}")
        return "CONTENT_NOT_AVAILABLE"
        
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