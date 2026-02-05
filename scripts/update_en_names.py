import xml.etree.ElementTree as ET
from pathlib import Path
from scripts.industry_classifier.dart_db_client import DARTDBClient

def sync_en_names():
    # 1. DB 클라이언트 초기화 (기존 파일 활용)
    db_client = DARTDBClient()
    
    # 2. XML 파일 읽기 (루트 디렉토리에 있다고 가정)
    xml_path = Path("corpCode.xml")
    if not xml_path.exists():
        print(f"❌ {xml_path.absolute()} 파일을 찾을 수 없습니다.")
        return

    print("🔍 XML 데이터를 읽어 DB를 업데이트합니다...")
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    count = 0
    # 3. XML의 모든 기업을 돌며 영문명 업데이트
    for company in root.findall('list'):
        stock_code = company.findtext('stock_code', '').strip()
        corp_name_eng = company.findtext('corp_name_eng', '').strip()
        
        # 상장사만 골라서 업데이트
        if stock_code and corp_name_eng:
            try:
                db_client.supabase.table("dart_corp_codes") \
                    .update({"corp_name_en": corp_name_eng}) \
                    .eq("stock_code", stock_code) \
                    .execute()
                count += 1
                if count % 100 == 0:
                    print(f"⏳ {count}개 완료...")
            except Exception as e:
                continue

    print(f"✅ 성공! 총 {count}개 기업의 영문명이 등록되었습니다.")

if __name__ == "__main__":
    sync_en_names()