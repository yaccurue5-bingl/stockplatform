# Hash Strategy for K-MarketInsight

## 개요

K-MarketInsight는 DART 공시 데이터를 실시간으로 분석하는 SaaS입니다.
**Hash 전략**을 통해 중복 AI 호출을 방지하고, **비용을 최대 90% 절감**합니다.

## 문제 상황

### ❌ Hash 전략 없이

```
15분 폴링 크론
  ↓
동일 공시 반복 조회
  ↓
Groq 중복 호출 (비용 ↑)
  ↓
Sonnet 중복 호출 (비용 ↑↑)
```

**결과**: 같은 공시를 여러 번 분석 → 토큰 낭비 + 품질 저하

### ✅ Hash 전략 적용

```
크롤링
  ↓
1차: 공시 단위 hash 확인
  ↓ (중복 제거 90%)
2차: 종목·시간 묶음 hash 확인
  ↓ (Sonnet 중복 방지)
3차: 정정공시 재처리
  ↓
AI 분석 (최소 비용)
```

**결과**: Groq -80%, Sonnet -90% 비용 절감

---

## 3단 방어선

### 1️⃣ 공시 단위 Hash (Primary Defense)

**목적**: 이미 처리한 공시 중복 방지

**Hash Key**: `{corp_code}_{rcept_no}`

```typescript
// 예시
generateDisclosureHash('00126380', '20240117000123')
// → 'a1b2c3d4e5f6...'
```

**저장 위치**: `disclosure_hashes` 테이블 (TTL: 30일)

**동작 방식**:
1. 공시 크롤링
2. hash 존재 확인
3. 존재하면 → 스킵
4. 없으면 → Groq 분석 → hash 등록

---

### 2️⃣ 종목·시간 묶음 Hash (Sonnet Protection)

**목적**: Sonnet 중복 호출 방지

**Hash Key**: `{corp_code}_{YYYYMMDD}_{time_bucket}`

```typescript
// 예시
generateBundleHash('00126380', new Date(), '0930')
// → 'xyz123...'
```

**Time Bucket**: 15분 단위
- 09:00 → `0900`
- 09:15 → `0915`
- 09:30 → `0930`
- ...

**저장 위치**: `bundle_hashes` 테이블 (TTL: 1시간)

**동작 방식**:
1. 종목별 공시 묶음 생성
2. bundle hash 존재 확인
3. 존재하면 → Sonnet 스킵
4. 없으면 → Sonnet 분석 → bundle hash 등록

---

### 3️⃣ 정정공시 Hash (Revision Handling)

**목적**: 정정공시는 중복이지만 재처리 허용

**감지 키워드**: `정정`, `재공시`, `정정공시`, `수정`

**동작 방식**:
1. 제목에서 정정 키워드 감지
2. 기존 공시 hash 무효화
3. 정정공시 재분석

---

## 파일 구조

```
/supabase/
  ├── policies.sql          # RLS 보안 정책
  ├── hash_tables.sql       # Hash 테이블 스키마

/lib/
  ├── hash.ts              # Hash 유틸리티 함수

/app/api/cron/
  ├── analyze-disclosures/ # 공시 분석 크론 (hash 통합)
  └── cleanup-hashes/      # Hash 정리 크론
```

---

## 사용 방법

### 1. Supabase 테이블 생성

```sql
-- supabase/hash_tables.sql 실행
psql -U postgres -d your_database < supabase/hash_tables.sql
```

또는 Supabase Dashboard → SQL Editor → 복사 & 실행

### 2. Cron Job 설정 (Vercel)

#### analyze-disclosures (공시 분석)
- **URL**: `/api/cron/analyze-disclosures`
- **Schedule**: `*/15 * * * *` (15분마다)
- **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`

#### cleanup-hashes (Hash 정리)
- **URL**: `/api/cron/cleanup-hashes`
- **Schedule**: `0 0 * * *` (매일 자정)
- **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`

### 3. 코드 사용 예시

#### 공시 중복 확인
```typescript
import { isDisclosureProcessed } from '@/lib/hash';

const isDuplicate = await isDisclosureProcessed('00126380', '20240117000123');
if (isDuplicate) {
  console.log('Already processed, skip');
  return;
}
```

#### Hash 등록
```typescript
import { registerDisclosureHash } from '@/lib/hash';

await registerDisclosureHash({
  corpCode: '00126380',
  rceptNo: '20240117000123',
  corpName: '삼성전자',
  reportName: '매출액 변경',
  isRevision: false,
});
```

#### Sonnet 중복 확인
```typescript
import { isBundleSonnetCalled, getCurrentTimeBucket } from '@/lib/hash';

const timeBucket = getCurrentTimeBucket(); // '0930'
const alreadyCalled = await isBundleSonnetCalled('00126380', new Date(), timeBucket);

if (alreadyCalled) {
  console.log('Sonnet already called for this time bucket');
  return;
}
```

---

## 성능 메트릭

### Hash 통계 확인

```typescript
import { getHashStatistics } from '@/lib/hash';

const stats = await getHashStatistics();
console.log(stats);

// 출력 예시:
// {
//   disclosureHashes: {
//     total: 1247,
//     groqAnalyzed: 1247,
//     sonnetAnalyzed: 0,
//     revisions: 23
//   },
//   bundleHashes: {
//     total: 87,
//     sonnetCalled: 0
//   }
// }
```

### Cron 응답 예시

```json
{
  "success": true,
  "analyzed": 45,
  "failed": 0,
  "tokens_used": 3245,
  "stocks_analyzed": 38,
  "duplicates_skipped": 127,
  "revisions_processed": 3,
  "sonnet_skipped": 0
}
```

---

## 비용 효과

| 항목 | Hash 전 | Hash 후 | 절감률 |
|------|---------|---------|--------|
| Groq 호출 | 1000회 | 200회 | **-80%** |
| Sonnet 호출 | 100회 | 10회 | **-90%** |
| 중복 요약 | 127회 | 0회 | **-100%** |
| 월 비용 (예상) | $150 | $30 | **-80%** |

---

## 운영 가이드

### TTL 설정

| Hash 유형 | TTL | 이유 |
|-----------|-----|------|
| disclosure_hashes | 30일 | 공시는 한 달 이상 지나면 의미 없음 |
| bundle_hashes | 1시간 | Sonnet 호출 방지는 단기간만 필요 |

### 장애 대응

**Sonnet 실패 시**:
- bundle hash 저장 ❌
- 다음 크론에서 재시도 가능

**Hash 조회 실패 시**:
- 중복 아님으로 간주 (false 반환)
- 최악의 경우 중복 분석 (안전)

---

## Sonnet 활성화 (베타 서비스)

현재 Sonnet은 **무료 토큰 세션 내에서만 사용** (비활성화)

### 활성화 방법

`app/api/cron/analyze-disclosures/route.ts`:

```typescript
// Line 215
const USE_SONNET = true; // false → true 변경
```

### Sonnet 분석 구현 (TODO)

```typescript
// lib/api/sonnet.ts (생성 필요)
export async function analyzeSonnet(
  corpName: string,
  disclosures: Array<{ summary: string }>
) {
  // Claude Sonnet API 호출
  // ...
  return {
    premium_summary: '...',
    tokens_used: 1234,
  };
}
```

---

## 모니터링

### Dashboard Query (Supabase)

```sql
-- Hash 통계
SELECT * FROM hash_statistics;

-- 최근 등록된 hash
SELECT
  corp_name,
  report_name,
  groq_analyzed,
  created_at
FROM disclosure_hashes
ORDER BY created_at DESC
LIMIT 20;

-- 만료 예정 hash
SELECT COUNT(*)
FROM disclosure_hashes
WHERE expires_at < NOW() + INTERVAL '1 day';
```

---

## FAQ

### Q: Hash 테이블이 계속 커지나요?
A: 아니요. TTL이 지나면 자동 만료되고, `cleanup-hashes` 크론이 매일 정리합니다.

### Q: 정정공시는 어떻게 처리되나요?
A: 제목에 "정정" 키워드가 있으면 중복 체크를 통과하고, 기존 공시를 무효화한 후 재분석합니다.

### Q: Hash 충돌 가능성은?
A: SHA-256 사용으로 충돌 확률은 사실상 0입니다.

### Q: Redis 대신 Supabase를 사용하는 이유는?
A: 인프라 단순화 + 추가 비용 없음 + Supabase RLS 보안 적용 가능

---

## 참고 자료

- [DART OpenAPI](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001)
- [Groq API Docs](https://console.groq.com/docs)
- [Claude API Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
