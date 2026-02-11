import os
import json
import logging
import time
from datetime import datetime
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

# 로깅 설정: 파일로도 저장하여 며칠간의 진행 상황 추적 가능
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("batch_analysis.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 환경 변수 로드
load_dotenv(r"C:\stockplatform\.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

class BatchAnalyst:
    def __init__(self):
        # 기존 auto_analyst.py의 프롬프트와 로직을 계승
        self.system_prompt = """
You are a professional Korean stock analyst. 
Analyze the provided disclosure content to determine its financial impact.
Respond ONLY in JSON format.
"""

    def analyze(self, corp_name, report_nm, content):
        try:
            # 본문 가용성 체크 로직
            is_invalid = not content or content == "CONTENT_NOT_AVAILABLE" or len(str(content)) < 20
            input_text = f"Title: {report_nm}\n(Analyze based on title)" if is_invalid else f"Title: {report_nm}\nContent: {content}"

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Company: {corp_name}\n{input_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"❌ {corp_name} 분석 에러: {e}")
            return None

def run_batch():
    analyst = BatchAnalyst()
    MAX_DAILY_LIMIT = 1000  # 하루 최대 분석 건수
    processed_count = 0
    
    logger.info("🚀 임시 배치 분석 스크립트 가동 (일일 한도: 1000건)")

    while processed_count < MAX_DAILY_LIMIT:
        # 아직 'completed'가 아니거나, 예전에 제목만으로 분석했던 데이터(pending)를 1건씩 가져옴
        # 'content'가 채워진 데이터부터 우선 처리
        res = supabase.table("disclosure_insights") \
            .select("id, corp_name, report_nm, content") \
            .eq("analysis_status", "pending") \
            .is_not("content", "null") \
            .limit(1) \
            .execute()

        if not res.data:
            logger.info("✅ 모든 대상 데이터의 재가공이 완료되었습니다.")
            break

        item = res.data[0]
        logger.info(f"🔄 [{processed_count + 1}/{MAX_DAILY_LIMIT}] {item['corp_name']} 분석 중...")

        result = analyst.analyze(item['corp_name'], item['report_nm'], item['content'])

        if result:
            update_data = {
                "ai_summary": "\n".join(result.get("summary", ["내용 없음"])),
                "sentiment": result.get("sentiment", "NEUTRAL").upper(),
                "sentiment_score": float(result.get("sentiment_score", 0.0)),
                "importance": result.get("importance", "MEDIUM").upper(),
                "analysis_status": "completed", # 처리 완료 마킹
                "updated_at": datetime.now().isoformat()
            }
            supabase.table("disclosure_insights").update(update_data).eq("id", item['id']).execute()
            processed_count += 1
            
            # 💡 1분당 1개 분석 제한을 위한 대기 시간 (60초)
            logger.info("😴 다음 분석을 위해 60초 대기 중...")
            time.sleep(60)
        else:
            # 실패 시 잠시 후 재시도할 수 있게 status를 유지하거나 retry_count 증가
            time.sleep(10)

    logger.info(f"🏁 오늘의 할당량({processed_count}건)을 모두 마쳤습니다.")

if __name__ == "__main__":
    run_batch()