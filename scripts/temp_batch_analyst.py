import os
import json
import logging
import time
import sys
from datetime import datetime
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

# 로깅 설정 (UTF-8 인코딩 적용)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("batch_test.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

load_dotenv(r"C:\stockplatform\.env.local")

supabase: Client = create_client(os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# auto_analyst.py의 AIAnalyst 클래스를 그대로 가져오거나 동일하게 설정
from auto_analyst import AIAnalyst

def run_test():
    analyst = AIAnalyst()
    processed_count = 0
    
    logger.info("[START] 삼성전자 단일 종목 테스트 시작")

    while True:
        # 🔍 테스트를 위해 '삼성전자'만 조회하도록 설정
        res = supabase.table("disclosure_insights") \
            .select("id, corp_name, report_nm, content") \
            .eq("analysis_status", "pending") \
            .not_.is_("content", "null") \
            .limit(50) \
            .execute()

        if not res.data:
            logger.info("✅ 더 이상 분석할 삼성전자 공시가 없습니다.")
            break

        item = res.data[0]
        logger.info(f"🔄 분석 중: {item['report_nm']}")

        result = analyst.analyze_content(item['corp_name'], item['report_nm'], item['content'])

        if result:
            # ✅ 최신 프롬프트 구조(key_numbers + analysis)에 맞춰 내용 생성
            key_numbers = "\n".join(result.get("key_numbers", []))
            analysis = result.get("analysis", "")
            combined_summary = f"[주요수치]\n{key_numbers}\n\n[투자분석]\n{analysis}"

            update_data = {
                "ai_summary": combined_summary,
                "sentiment": result.get("financial_impact", "NEUTRAL").upper(),
                "importance": "HIGH" if result.get("short_term_impact_score", 0) >= 4 else "MEDIUM",
                "analysis_status": "completed",
                "updated_at": datetime.now().isoformat()
            }
            
            supabase.table("disclosure_insights").update(update_data).eq("id", item['id']).execute()
            processed_count += 1
            logger.info(f"✅ 완료: {item['corp_name']} - {result.get('headline')}")
            
            # 1분 대기
            logger.info("😴 다음 분석을 위해 60초 대기 중...")
            time.sleep(0.5)
            
        else:
            logger.warning(f"⚠️ {item['corp_name']} 분석 실패, 10초 대기")
            time.sleep(1)

if __name__ == "__main__":
    run_test()