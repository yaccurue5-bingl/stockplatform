# Sharding Strategy for K-MarketInsight

## 개요

K-MarketInsight는 **종목 수가 증가해도 cron을 늘리지 않고** 부하를 분산하는 Sharding 전략을 사용합니다.

## 문제 상황

### ❌ Sharding 없이 (문제)

```
15분 cron 실행
  ↓
종목 100개 동시 크롤링
  ↓
Groq 100회 동시 호출
  ↓
Sonnet 폭증 (종목 몰림)
  ↓
API rate limit / 비용 폭증
```

**결과**:
- 부하 집중 (특정 분에만 폭발)
- API rate limit 초과 가능
- 무료 플랜에서 불안정

### ✅ Sharding 적용 (해결)

```
15분 window
 ├─ 00~04분 : Shard 0 처리
 ├─ 05~09분 : Shard 1 처리
 ├─ 10~14분 : Shard 2 처리
```

**결과**:
- cron은 그대로 15분마다 실행
- 하지만 각 실행마다 종목의 1/3만 처리
- 부하 분산 + API 안정성 ↑

---

## 핵심 원리

### 1. Hash 기반 Shard 할당

```typescript
// corp_code를 MD5 hash → shard 번호로 변환
assignShard('00126380') // → 0
assignShard('005930')   // → 1
assignShard('035720')   // → 2
```

**특징**:
- 같은 종목은 항상 같은 shard
- 종목 추가/삭제 시 자동 재분배
- DB/Redis 상태 필요 없음

### 2. 시간 Window

15분을 shard 수로 나눔:

| Shard | Window | 예시 시간 |
|-------|--------|----------|
| 0 | 00~04분 | 09:00, 09:15, 09:30 |
| 1 | 05~09분 | 09:05, 09:20, 09:35 |
| 2 | 10~14분 | 09:10, 09:25, 09:40 |

**동작**:
1. 09:02에 cron 실행 → Shard 0만 처리
2. 09:07에 cron 실행 → Shard 1만 처리
3. 09:12에 cron 실행 → Shard 2만 처리

### 3. HOT STOCKS (우선 처리)

특정 종목은 sharding 우회:
- 거래대금 상위
- 공시 다발 종목
- 유료 사용자 관심 종목

```typescript
if (isHotStock(corpCode)) {
  // Shard 무시하고 즉시 처리
  process();
}
```

---

## 사용 방법

### 1. 환경변수 설정

`.env.local`:
```bash
# Shard 개수 (기본값: 3)
SHARD_COUNT=3
```

**권장 값**:
| 종목 수 | SHARD_COUNT |
|---------|-------------|
| ~30 | 1 (샤딩 불필요) |
| 30~100 | 3 |
| 100~300 | 5 |
| 300~1,000 | 10 |

### 2. Cron 설정 (변경 없음)

Vercel Cron은 **그대로**:
- **Path**: `/api/cron/analyze-disclosures`
- **Schedule**: `*/15 * * * *` (15분마다)

Sharding은 코드 내부에서 자동 처리됩니다.

### 3. HOT STOCKS 관리

`lib/sharding.ts`:

```typescript
// Hot stock 추가 (런타임)
addHotStock('005930'); // Samsung Electronics

// Hot stock 제거
removeHotStock('005930');

// 또는 코드에서 직접 수정
const HOT_STOCKS = new Set<string>([
  '005930', // Samsung Electronics
  '000660', // SK Hynix
  // ...
]);
```

---

## API 구조

### Sharding 유틸리티

`lib/sharding.ts`:

```typescript
// Shard 할당
assignShard(corpCode: string): number

// 현재 window 확인
getCurrentWindow(): number

// 지금 처리해야 하나?
shouldProcessNow(corpCode: string): boolean

// Hot stock 여부
isHotStock(corpCode: string): boolean

// 상태 조회 (모니터링)
getShardingStatus(): object
```

### Cron Job 통합

`app/api/cron/analyze-disclosures/route.ts`:

```typescript
for (const [stockCode, disclosures] of grouped.entries()) {
  const corpCode = disclosures[0].corp_code;

  // Sharding 확인
  if (!isHotStock(corpCode) && !shouldProcessNow(corpCode)) {
    console.log('⏭️ Shard skip: not in current window');
    continue; // 이 종목은 다음 window에서 처리
  }

  // 분석 진행
  analyzeDisclosures(disclosures);
}
```

---

## 모니터링

### Cron 응답 예시

```json
{
  "success": true,
  "analyzed": 12,
  "shard_skipped": 25,
  "sharding": {
    "window": 1,
    "range": "5~9 min",
    "shard_count": 3
  }
}
```

**해석**:
- 현재 window 1 (5~9분)
- 12개 종목 처리 (Shard 1)
- 25개 종목 스킵 (Shard 0, 2는 다음에)

### 로그 예시

```
📊 Sharding: window 1 (5~9 min), 3 shards
🔍 Analyzing 삼성전자 (005930): 2 disclosures
⏭️ Shard skip: 현대차 (not in current window)
🔥 Hot stock: SK하이닉스 (bypassing shard)
🔀 Shard stats: 25 stocks skipped (not in current window)
```

### Shard 분포 확인 (개발용)

```typescript
import { getShardDistribution } from '@/lib/sharding';

const corpCodes = ['005930', '035720', '000660', ...];
const distribution = getShardDistribution(corpCodes, 3);

// Map {
//   0 => ['005930', '051910', ...],  // 33개
//   1 => ['035720', '012330', ...],  // 34개
//   2 => ['000660', '066570', ...]   // 33개
// }
```

---

## 성능 효과

### Before vs After

| 항목 | Sharding 전 | Sharding 후 (3 shards) |
|------|-------------|------------------------|
| 동시 처리 종목 | 100개 | 33개 |
| 피크 부하 | 100% | 33% |
| Groq 동시 호출 | 100회 | 33회 |
| Sonnet 동시 호출 | 50회 | 17회 |
| API 안정성 | 낮음 | 높음 |

### 비용 효과

Sharding 자체는 비용을 줄이지 않지만:
- **부하 분산** → API rate limit 회피
- **안정성** → 실패 재시도 감소
- **확장성** → 종목 수 증가해도 안정

---

## 확장 시나리오

### 종목 30개 → 300개 증가

**Sharding 없이**:
- cron 1개로 300개 동시 처리
- Groq/Sonnet 과부하
- API limit 초과

**Sharding으로**:
- `SHARD_COUNT=5` 설정
- cron 1개, 종목은 5개 window로 분산
- 각 window당 60개씩 처리
- 안정적 운영

---

## HOT STOCKS 전략

### 우선 처리 대상

1. **거래대금 상위**
   - KOSPI 상위 10개
   - KOSDAQ 상위 5개

2. **공시 다발 종목**
   - 최근 24시간 공시 3개 이상

3. **유료 사용자 관심 종목**
   - 프리미엄 사용자 watchlist

### 자동 추가 로직 (TODO)

```typescript
// 거래대금 기준 자동 HOT_STOCKS 갱신
async function updateHotStocks() {
  const topStocks = await getTopTradingStocks(10);
  topStocks.forEach(code => addHotStock(code));
}

// 매일 오전 9시 실행
cron.schedule('0 9 * * *', updateHotStocks);
```

---

## 장애 대응

### Q: Shard 처리 실패 시?
A: 다음 15분 window에 자동 재시도
- hash 기반이므로 같은 shard 재할당
- 자동 복구

### Q: 특정 window만 계속 실패?
A: Hot stock으로 전환
```typescript
addHotStock('005930'); // 다른 window에서도 처리
```

### Q: 종목 추가/삭제 시?
A: 자동 재분배
- hash 기반이므로 자동 균등 배치
- 특별한 작업 불필요

---

## 베스트 프랙티스

### 1. 적정 Shard 수 유지

❌ **너무 많은 Shard**:
- Shard 10개 → window 당 1.5분
- 시간 부족 가능

✅ **적정 Shard**:
- 3~5개 권장
- window 당 3~5분 확보

### 2. HOT_STOCKS 최소화

- 너무 많으면 sharding 효과 감소
- 10~20개 이내 유지

### 3. 모니터링

- `shard_skipped` 수치 확인
- 균등 분산 확인
- window별 처리 시간 확인

---

## 참고 코드

### Shard 할당 예시

```typescript
import { assignShard } from '@/lib/sharding';

const corpCodes = ['005930', '035720', '000660'];

corpCodes.forEach(code => {
  const shard = assignShard(code, 3);
  console.log(`${code} → Shard ${shard}`);
});

// 출력:
// 005930 → Shard 1
// 035720 → Shard 2
// 000660 → Shard 0
```

### Window 확인 예시

```typescript
import { getCurrentWindow, shouldProcessNow } from '@/lib/sharding';

const now = new Date('2026-01-17T09:07:00'); // 09:07
const window = getCurrentWindow(now, 3); // → 1 (5~9분)

const should = shouldProcessNow('005930', now, 3);
// → true (005930은 Shard 1)
```

---

## 마이그레이션 가이드

### 기존 시스템에서 Sharding 추가

1. `.env.local`에 `SHARD_COUNT=3` 추가
2. Vercel 환경변수에도 추가
3. Deploy

**변경 사항**:
- Cron 설정: 변경 없음
- 동작: 자동으로 sharding 적용
- 기존 데이터: 영향 없음

---

## 요약

| 구분 | 설명 |
|------|------|
| **목적** | 종목 수 증가 시 부하 분산 |
| **방식** | Hash 기반 시간 window 분산 |
| **cron 변경** | 없음 (그대로 15분마다) |
| **shard 수** | 환경변수로 제어 (기본 3) |
| **Hot stock** | Sharding 우회, 즉시 처리 |
| **확장성** | 종목 수 10배 증가해도 안정 |

---

## 다음 단계

**현재 구현 완료**:
- ✅ Hash 기반 shard 할당
- ✅ 시간 window 분산
- ✅ Hot stock 우회
- ✅ Cron 통합

**향후 개선 (Optional)**:
- [ ] 거래대금 기반 자동 Hot stock
- [ ] Shard별 처리 시간 모니터링
- [ ] 동적 shard 수 조정
- [ ] Sonnet 종목별 큐 (직렬화)
