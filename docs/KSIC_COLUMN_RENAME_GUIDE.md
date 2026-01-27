# KSIC 컬럼명 변경 가이드

## 개요

KSIC 데이터베이스 테이블의 컬럼명을 한글에서 영문 표준으로 변경했습니다.

## 컬럼 매핑 규칙

| 기존 (한글) | 변경 (영문) | 설명 |
|-----------|-----------|------|
| 산업코드 | `ksic_code` | KSIC 산업분류 코드 |
| 산업내용 | `ksic_name` | KSIC 산업명칭 |
| 상위업종 | `top_industry` | 상위 업종 분류 |

## 변경된 파일 목록

### 1. 데이터베이스 마이그레이션
- `supabase/migrations/004_rename_ksic_columns_to_english.sql`
  - 한글 컬럼명을 영문으로 변경하는 마이그레이션
  - 기존 데이터 보존하면서 컬럼명만 변경
  - Primary key 및 인덱스 재생성

### 2. Python 코드

#### main.py
- **408번 라인**: `select('산업코드')` → `select('ksic_code')`
- **426번 라인**: `select('산업내용')` → `select('ksic_name')`
- **429번 라인**: `record.get('산업내용')` → `record.get('ksic_name')`

#### scripts/validate_ksic_data.py
- **155번 라인**: `record.get('산업코드')` → `record.get('ksic_code')`
- **157번 라인**: `record.get('산업내용')` → `record.get('ksic_name')`
- **168번 라인**: 경고 메시지 수정
- **212번 라인**: `select('산업코드, 산업내용')` → `select('ksic_code, ksic_name, top_industry')`
- **217번 라인**: `record.get('산업코드')` → `record.get('ksic_code')`
- **218번 라인**: `record.get('산업내용')` → `record.get('top_industry')`
- **340-345번 라인**: 통계 생성 부분 수정

#### scripts/import_ksic_data.py
- ✅ 이미 영문 컬럼명 사용 중 (수정 불필요)

## 마이그레이션 적용 방법

### 방법 1: Supabase Dashboard에서 적용 (권장)

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭
4. **New Query** 클릭
5. `supabase/migrations/004_rename_ksic_columns_to_english.sql` 파일 내용 복사
6. SQL Editor에 붙여넣기
7. **Run** 버튼 클릭하여 실행
8. 성공 메시지 확인

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI 설치 (없는 경우)
npm install -g supabase

# 프로젝트 링크
supabase link --project-ref [YOUR_PROJECT_REF]

# 마이그레이션 적용
supabase db push
```

### 방법 3: Python 스크립트로 직접 실행

```python
from supabase import create_client
import os

# Supabase 클라이언트 생성
supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key)

# 마이그레이션 SQL 읽기
with open('supabase/migrations/004_rename_ksic_columns_to_english.sql', 'r', encoding='utf-8') as f:
    migration_sql = f.read()

# 실행
supabase.rpc('exec_sql', {'sql': migration_sql}).execute()
```

## 마이그레이션 검증

마이그레이션 적용 후 다음 명령으로 검증:

```bash
# KSIC 데이터 검증
python scripts/validate_ksic_data.py

# 또는 API를 통해 검증
curl http://localhost:8000/api/ksic/validate
```

## 주의사항

1. **백업 필수**: 마이그레이션 전에 반드시 데이터베이스 백업을 수행하세요.
   ```bash
   # Supabase Dashboard > Database > Backups 에서 수동 백업 생성
   ```

2. **서비스 중단 고려**: 마이그레이션 중 짧은 시간 동안 서비스가 중단될 수 있습니다.

3. **롤백 방법**: 문제 발생 시 다음 SQL로 롤백 가능:
   ```sql
   -- 롤백 (한글 컬럼명으로 되돌리기)
   ALTER TABLE public.ksic_codes RENAME COLUMN ksic_code TO "산업코드";
   ALTER TABLE public.ksic_codes RENAME COLUMN ksic_name TO "산업내용";
   ALTER TABLE public.ksic_codes RENAME COLUMN top_industry TO "상위업종";
   ```

## 마이그레이션 후 작업

1. **Python 애플리케이션 재시작**
   ```bash
   # FastAPI 서버 재시작
   pkill -f "python main.py"
   python main.py
   ```

2. **KSIC 데이터 재임포트** (필요한 경우)
   ```bash
   python scripts/import_ksic_data.py
   ```

3. **전체 셋업 실행** (선택사항)
   ```bash
   # API를 통한 전체 셋업
   curl -X POST http://localhost:8000/api/ksic/setup-all \
     -H "Content-Type: application/json" \
     -d '{"skip_import": false, "skip_validation": false, "skip_mapping": false}'
   ```

## 문제 해결

### 문제: "column does not exist" 오류

**원인**: 마이그레이션이 아직 적용되지 않았거나, 컬럼명이 다름

**해결**:
1. 마이그레이션 파일 재실행
2. 데이터베이스의 실제 컬럼명 확인:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'ksic_codes'
   ORDER BY ordinal_position;
   ```

### 문제: Primary key 충돌

**원인**: 기존 primary key와 새 primary key가 충돌

**해결**:
1. 기존 constraint 수동 삭제:
   ```sql
   ALTER TABLE public.ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;
   ```
2. 마이그레이션 재실행

## 참고 자료

- [Supabase Migrations](https://supabase.com/docs/guides/cli/managing-environments)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- 프로젝트 내 KSIC 관련 문서: `docs/KSIC_SETUP_GUIDE.md`
