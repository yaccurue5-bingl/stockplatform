# Supabase Database Setup Guide

## 🚀 Quick Start

### **프로덕션 환경 (기존 데이터 보존)** ⭐ 권장

**이미 공시 데이터가 있고 보존해야 하는 경우:**

1. Supabase Dashboard 접속
2. SQL Editor 열기
3. **`migrate_safe.sql`** 파일 전체 복사
4. 붙여넣기 후 **Run** 클릭

이 스크립트는:
- ✅ **기존 데이터 100% 보존**
- ✅ 누락된 컬럼만 추가 (sonnet_analyzed, is_sample_disclosure 등)
- ✅ 누락된 테이블만 생성 (profiles, subscriptions 등)
- ✅ 기존 disclosure_insights 데이터 유지
- ✅ RLS 정책 업데이트
- ✅ yaccurue3@naver.com → Premium 업그레이드

---

### **테스트/개발 환경 (데이터 리셋)**

**새로운 프로젝트이거나 데이터베이스를 깨끗이 시작하려면:**

### ⚠️ 경고: 기존 데이터가 모두 삭제됩니다!

1. Supabase Dashboard 접속
2. SQL Editor 열기
3. **`reset_and_setup.sql`** 파일 전체 복사
4. 붙여넣기 후 **Run** 클릭

이 스크립트는:
- ⚠️ 기존 테이블 삭제 (disclosure_insights, hashes, hot_stocks, profiles, subscriptions)
- ✅ 모든 테이블 새로 생성
- ✅ RLS 정책 설정
- ✅ yaccurue3@naver.com 계정을 Premium으로 업그레이드
- ✅ 설정 완료 확인

---

## 📝 파일 설명

### 1. `migrate_safe.sql` ⭐ **프로덕션 권장**
**용도**: 안전한 스키마 업데이트 (데이터 보존)
- 기존 데이터 100% 유지
- 누락된 컬럼만 `ALTER TABLE ADD COLUMN IF NOT EXISTS`로 추가
- 누락된 테이블만 `CREATE TABLE IF NOT EXISTS`로 생성
- **사용 시기**:
  - 🔥 **프로덕션 환경 (가장 안전!)**
  - 기존 공시 데이터를 보존해야 할 때
  - 스키마만 업데이트하고 싶을 때
  - column not found 에러 발생 시

### 2. `reset_and_setup.sql` ⚠️ **테스트 전용**
**용도**: 전체 데이터베이스 리셋 및 초기 설정
- 기존 테이블 DROP 후 새로 생성
- **주의**: 모든 데이터 삭제됨!
- **사용 시기**:
  - 개발/테스트 환경
  - 첫 설정 시
  - 데이터가 없거나 삭제해도 되는 경우

### 3. `setup_all.sql` ⚠️ **비권장**
**용도**: 테이블이 없을 때만 생성 (데이터 보존)
- `CREATE TABLE IF NOT EXISTS` 사용
- 기존 테이블은 건드리지 않음
- **주의**: 기존 테이블이 있으면 스키마가 업데이트되지 않음!
- **문제**: 컬럼이 누락되어도 추가 안 됨
- **사용 시기**:
  - 거의 사용 안 함 (migrate_safe.sql 사용 권장)

### 3. `verify_and_upgrade_user.sql`
**용도**: 테스트 계정(yaccurue3@naver.com) 상태 확인 및 Premium 업그레이드
- 계정 존재 여부 확인
- Profile 생성
- Premium subscription 생성/업데이트
- **사용 시기**:
  - 테스트 계정 확인 필요 시
  - Premium 권한 부여 필요 시

---

## 🔧 문제 해결

### ❌ 에러: `column "corp_code" does not exist`

**원인**: 이전 버전의 disclosure_insights 테이블이 남아있음

**해결**:
```sql
-- reset_and_setup.sql 실행
-- 또는 수동으로:
DROP TABLE IF EXISTS disclosure_insights CASCADE;
-- 그 다음 setup_all.sql 실행
```

### ❌ 에러: `relation "profiles" does not exist`

**원인**: profiles 테이블이 생성되지 않음

**해결**:
```sql
-- reset_and_setup.sql 실행 (모든 테이블 포함)
```

### ❌ 에러: `CREATE POLICY IF NOT EXISTS` syntax error

**원인**: PostgreSQL은 `CREATE POLICY IF NOT EXISTS`를 지원하지 않음

**해결**:
- 이미 수정됨! `DROP POLICY IF EXISTS` 사용
- `reset_and_setup.sql` 또는 `setup_all.sql` 실행

---

## ✅ 실행 순서 (처음 설정 시)

### Option A: 간단한 방법 (권장)
```
1. reset_and_setup.sql 실행 → 끝!
```

### Option B: 단계별 방법
```
1. setup_all.sql 실행
   → 에러 발생 시: reset_and_setup.sql 실행

2. verify_and_upgrade_user.sql 실행
   → 테스트 계정 확인
```

---

## 📊 실행 후 확인 사항

SQL Editor에서 실행하여 확인:

```sql
-- 1. 테이블 존재 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'disclosure_insights',
    'disclosure_hashes',
    'bundle_hashes',
    'hot_stocks',
    'profiles',
    'subscriptions'
  )
ORDER BY table_name;

-- 2. disclosure_insights 스키마 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'disclosure_insights'
ORDER BY ordinal_position;

-- 3. 테스트 계정 확인
SELECT
  u.email,
  p.id as profile_id,
  s.plan_type,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';
```

---

## 🎯 다음 단계

데이터베이스 설정 완료 후:

1. **Vercel 환경변수 설정**
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   ENABLE_SONNET_SAMPLE=true
   CRON_SECRET_TOKEN=your-random-token
   ```

2. **Google OAuth 설정** (선택사항)
   - Supabase Dashboard → Authentication → Providers
   - Google 활성화 및 Client ID/Secret 입력

3. **Cron Job 테스트**
   ```bash
   npm run dev
   # 또는
   ./scripts/test-cron.sh
   ```

4. **배포**
   ```bash
   git push
   vercel --prod
   ```

---

## 📞 도움이 필요하면

- SQL 에러 발생 시: 전체 에러 메시지 공유
- 테이블 확인: 위 "실행 후 확인 사항" 쿼리 실행 결과 공유
- 계정 문제: verify_and_upgrade_user.sql 실행 결과 공유
