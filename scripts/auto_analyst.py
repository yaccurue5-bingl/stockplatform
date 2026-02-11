import os
import json
import logging
import time
import hashlib
import re
from datetime import datetime
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 환경 변수 로드
local_env_path = r"C:\stockplatform\.env.local"
if os.path.exists(local_env_path):
    load_dotenv(local_env_path)
else:
    load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

class AIAnalyst:
    def __init__(self):
        # AI 프롬프트: 수치 중심 분석 및 본문 부재 시 제목 활용 지침 포함
        self.system_prompt = """
You are a professional Korean stock analyst. 
Analyze the provided disclosure content to determine its financial impact.

STRICT RULES:
1. Identify specific numbers: revenue changes, profit/loss, contract amounts.
2. Sentiment must reflect the ACTUAL financial impact:
   - POSITIVE: Profit increase, deficit reduction, major new contracts, capital increase.
   - NEGATIVE: Profit decrease, deficit increase, lawsuit, recall, cancellation.
3. If the content is "CONTENT_NOT_AVAILABLE" or too short, analyze based on the Title and company context.
4. Escape all double quotes within the summary strings.

Respond ONLY in JSON format:
{
  "headline": "English headline summarizing the core numerical change",
  "summary": ["Detailed Korean bullet 1 including numbers", "Bullet 2", "Bullet 3"],
  "sentiment": "POSITIVE or NEGATIVE or NEUTRAL",
  "sentiment_score": 0.00,
  "importance": "HIGH or MEDIUM or LOW"
}
"""

    def analyze_content(self, corp_name, report_nm, content):
        try:
            # 1. 본문 상태 체크 (수집 불가 마킹 확인)
            is_empty = not content or str(content).strip() == ""
            is_not_available = str(content) == "CONTENT_NOT_AVAILABLE"
            
            if is_empty or is_not_available:
                # 본문이 없을 경우 제목 기반 분석 유도
                input_text = f"Title: {report_nm}\n(Note: Detailed document content is not available. Analyze based on Title.)"
                logger.info(f"ℹ️ {corp_name}: 제목 기반 분석 진행")
            else:
                # 본문 정제 및 입력 구성
                clean_content = str(content).replace('\x00', '').replace('\u0000', '')
                if len(clean_content) < 20:
                    input_text = f"Title: {report_nm}\nContent: {clean_content}\n(Note: Short content. Use Title primarily.)"
                else:
                    input_text = f"Title: {report_nm}\n\nContent: {clean_content}"

            # 2. Groq AI 호출
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Company: {corp_name}\n{input_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_completion_tokens=1000
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"❌ [{corp_name}] 분석 에러: {e}")
            return None

def run():
    analyst = AIAnalyst()
    
    # 분석 대기 중이거나 재시도 횟수가 3회 미만인 데이터 가져오기
    res = supabase.table("disclosure_insights") \
        .select("id, corp_name, report_nm, content, rcept_no, analysis_retry_count") \
        .eq("analysis_status", "pending") \
        .or_("analysis_retry_count.is.null,analysis_retry_count.lt.3") \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute()
    
    if not res.data:
        logger.info("✅ 분석할 데이터가 없습니다.")
        return

    for item in res.data:
        # 현재 상태를 processing으로 변경
        supabase.table("disclosure_insights").update({"analysis_status": "processing"}).eq("id", item['id']).execute()
        
        result = analyst.analyze_content(item['corp_name'], item['report_nm'], item.get('content'))
        
        if result:
            # 성공 시 데이터 업데이트
            update_data = {
                "ai_summary": "\n".join(result.get("summary", ["내용 없음"])),
                "sentiment": result.get("sentiment", "NEUTRAL").upper(),
                "sentiment_score": float(result.get("sentiment_score", 0.0)),
                "importance": result.get("importance", "MEDIUM").upper(),
                "analysis_status": "completed",
                "updated_at": datetime.now().isoformat()
            }
            supabase.table("disclosure_insights").update(update_data).eq("id", item['id']).execute()
            logger.info(f"✅ 완료: {item['corp_name']} ({result.get('sentiment')})")
        else:
            # 실패 시 재시도 횟수 증가 및 상태 복구
            retry_count = (item.get('analysis_retry_count') or 0) + 1
            new_status = "failed" if retry_count >= 3 else "pending"
            supabase.table("disclosure_insights").update({
                "analysis_status": new_status,
                "analysis_retry_count": retry_count,
                "updated_at": datetime.now().isoformat()
            }).eq("id", item['id']).execute()
            logger.warning(f"⚠️ 실패: {item['corp_name']} (재시도: {retry_count}/3)")
            
        time.sleep(2.0) # Rate Limit 방지

if __name__ == "__main__":
    run()