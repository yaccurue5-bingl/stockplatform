import pandas as pd
from pathlib import Path

# 1. 파일 경로 설정 (본인의 경로에 맞게 수정)
excel_file = "11차 개정(2024년부터 적용).xlsx"
csv_file = "ksic_mapping.csv"

try:
    # 2. 엑셀 파일 읽기
    # 파일이 안 열려도 파이썬 라이브러리가 내부적으로 데이터를 읽어옵니다.
    print(f"📖 {excel_file} 읽는 중...")
    df = pd.read_excel(excel_file)

    # 3. CSV로 저장 (인코딩은 한글 깨짐 방지를 위해 'utf-8-sig' 권장)
    df.to_csv(csv_file, index=False, encoding='utf-8-sig')
    print(f"✅ 변환 완료! 생성된 파일: {csv_file}")

except Exception as e:
    print(f"❌ 에러 발생: {e}")