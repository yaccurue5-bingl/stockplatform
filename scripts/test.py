import os
import requests
import re
import zipfile
import io
import logging
from supabase import create_client, Client
from dotenv import load_dotenv
import urllib3

# SSL 및 로깅 설정
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv(r"C:\stockplatform\.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DART_API_KEY = os.environ.get("DART_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_clean_content_test(rcept_no):
    """ZIP 압축 해제 후 순수 텍스트 추출 테스트"""
    url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_API_KEY}&rcept_no={rcept_no}"
    try:
        response = requests.get(url, verify=False, timeout=20)
        if response.status_code == 200:
            # 1. 압축 해제 로직
            with zipfile.ZipFile(io.BytesIO(response.content)) as zip_file:
                xml_filename = zip_file.namelist()[0]
                with zip_file.open(xml_filename) as f:
                    raw_xml = f.read().decode('utf-8')
            
            # 2. 텍스트 정제 (태그 및 유니코드 제거)
            text = re.sub(r'<[^>]*>', '', raw_xml)
            text = text.replace('\x00', '').replace('\u0000', '')
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text[:2500] # 분석용 2500자
    except Exception as e:
        logger.error(f"❌ 추출 실패: {e}")
    return None

def run_test():
    target_corp = "셀로맥스사이언스"
    logger.info(f"🔍 {target_corp} 테스트 시작...")

    # 1. DB에서 해당 기업의 가장 최근 공시 1건 가져오기
    res = supabase.table("disclosure_insights") \
        .select("id, rcept_no, report_nm") \
        .eq("corp_name", target_corp) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if not res.data:
        logger.error(f"❌ DB에서 {target_corp} 데이터를 찾을 수 없습니다.")
        return

    item = res.data[0]
    rcept_no = item['rcept_no']
    logger.info(f"📡 대상 공시: {item['report_nm']} ({rcept_no})")

    # 2. 본문 추출 실행
    content = get_clean_content_test(rcept_no)

    # ... (생략: content 추출 로직 뒤) ...
    if content:
        # 3. DB 업데이트 및 결과 받기
        response = supabase.table("disclosure_insights") \
            .update({"content": content}) \
            .eq("id", item['id']) \
            .execute()
        
        # ✅ 업데이트 결과 데이터 출력
        if response.data:
            logger.info(f"🎉 DB 업데이트 확정! 업데이트된 ID: {response.data[0]['id']}")
            logger.info(f"📝 내용 샘플: {response.data[0]['content'][:50]}...")
        else:
            logger.error("❌ DB 업데이트에 실패했습니다. (조건에 맞는 행이 없거나 권한 문제)")
            # 💡 팁: id 대신 rcept_no로 재시도해보기
            logger.info(f"🔄 rcept_no({rcept_no})로 재시도합니다...")
            retry_res = supabase.table("disclosure_insights") \
                .update({"content": content}) \
                .eq("rcept_no", rcept_no) \
                .execute()
            if retry_res.data:
                logger.info("✅ rcept_no로 업데이트 성공!")
    else:
        logger.error("❌ 본문 추출 결과가 비어있습니다.")

if __name__ == "__main__":
    run_test()