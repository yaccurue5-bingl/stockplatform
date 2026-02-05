# scripts/update_en_names.py (신규 생성)
from scripts.industry_classifier.dart_api import DARTClient
from scripts.industry_classifier.dart_db_client import DARTDBClient

def sync_english_names():
    api_client = DARTClient()
    db_client = DARTDBClient()
    
    # 1. XML에서 데이터 로드 (수정된 dart_api 사용)
    corp_map = api_client.load_corp_code_map()
    
    # 2. DB 업데이트
    for stock_code, info in corp_map.items():
        db_client.supabase.table("dart_corp_codes").update({
            "corp_name_en": info['corp_name_en']
        }).eq("stock_code", info['stock_code']).execute()
    
    print("✅ 영문명 업데이트 완료!")

if __name__ == "__main__":
    sync_english_names()