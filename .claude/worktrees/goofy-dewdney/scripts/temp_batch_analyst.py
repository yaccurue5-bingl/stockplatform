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

# 환경 변수 로드
load_dotenv(r"C:\stockplatform\.env.local")

supabase: Client = create_client(os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# auto_analyst.py의 AIAnalyst 클래스 임포트
from auto_analyst import AIAnalyst

def run_test():
    analyst = AIAnalyst()
    processed_count = 0  # ✅ 변수 선언 위치 확인
    
    # 1. 분석 대상 100개 추출
    res = supabase.table("disclosure_insights") \
        .select("id, corp_name, report_nm, content") \
        .eq("analysis_status", "pending") \
        .not_.is_("content", "null") \
        .limit(500) \
        .execute()

    if not res.data:
        logger.info("✅ 분석할 공시가 없습니다.")
        return

    logger.info(f"🚀 총 {len(res.data)}개의 공시 분석을 시작합니다.")

    # 2. 가져온 데이터에 대해 루프 실행 (분석 로직을 루프 안으로 이동)
    for item in res.data:
        try:
            logger.info(f"🔄 분석 중: {item['corp_name']} - {item['report_nm']}")
            
            # 실제 AI 분석 호출
            result = analyst.analyze_content(item['corp_name'], item['report_nm'], item['content'])

            if result:
                # ✅ 최신 프롬프트 구조(key_numbers + ai_summary)에 맞춰 내용 생성
                key_numbers = "\n".join(result.get("key_numbers", []))
                analysis = result.get("ai_summary", "")
                combined_summary = f"[Key Numbers]\n{key_numbers}\n\n[Investment Analysis]\n{analysis}"

                update_data = {
                    "report_nm": result.get("report_nm"),
                    "ai_summary": combined_summary,
                    "sentiment": result.get("financial_impact", "NEUTRAL").upper(),
                    "importance": "HIGH" if int(result.get("short_term_impact_score", 0)) >= 4 else "MEDIUM",
                    "analysis_status": "completed",
                    "updated_at": datetime.now().isoformat(),
                    "headline": result.get("headline", "")
                }
                
                # DB 업데이트
                supabase.table("disclosure_insights").update(update_data).eq("id", item['id']).execute()
                
                processed_count += 1
                logger.info(f"✅ [{processed_count}/{len(res.data)}] 완료: {item['corp_name']}")
                
                # Groq API 속도 제한(Rate Limit) 방지를 위한 짧은 대기
                time.sleep(0.5) 
                
            else:
                logger.warning(f"⚠️ {item['corp_name']} 분석 결과가 없어 건너뜁니다.")
                time.sleep(1)

        except Exception as e:
            logger.error(f"❌ {item['corp_name']} 처리 중 치명적 오류: {e}")
            continue

    logger.info(f"🏁 총 {processed_count}개의 분석이 완료되어 스크립트를 종료합니다.")

if __name__ == "__main__":
    run_test()