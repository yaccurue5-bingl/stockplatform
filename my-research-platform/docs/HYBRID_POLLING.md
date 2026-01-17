# Hybrid Polling Strategy (하이브리드 폴링 전략)

## 개요

K-MarketInsight는 **하이브리드 폴링 전략**을 사용하여 중요한 종목만 집중 모니터링합니다.

- **일반 종목**: 15분 폴링 (기본)
- **Hot Stocks**: 5분 폴링 (급등락 감지 시)

이를 통해 **API 비용을 절감**하면서도 **중요 변동을 놓치지 않습니다**.

---

## 핵심 개념

### Hot Stocks (급등락 종목)

다음 조건 중 하나를 만족하면 **5분 폴링**으로 승격:

1. **가격 급변동**: ±5% 이상 변동 (5/15분 기준)
2. **거래량 급증**: 5일 평균 대비 2배 이상
3. **중요 공시**: 중대성 `high` 또는 극단적 sentiment

### TTL (Time To Live)

- **승격 시간**: 60분
- **갱신 가능**: 최대 5회
- **최대 유지 시간**: 300분 (5시간)
- **만료 후**: 자동으로 15분 폴링으로 복귀

### 동시 제한

- **최대 hot stocks**: 20개
- **우선순위**: 최신 승격 종목 우선
- **초과 시**: 가장 오래된 종목 자동 해제

---

## 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│           15분 폴링 (analyze-disclosures)            │
│                                                      │
│  1. DART 공시 수집                                    │
│  2. Hash 중복 확인                                    │
│  3. Sharding 필터링                                   │
│  4. Groq 분석                                         │
│  5. ✨ Hot Stock 트리거 감지                          │
│     └─> 조건 만족 시 승격                              │
│                                                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ 승격 (promote_to_hot_stock)
                   ▼
         ┌──────────────────┐
         │   hot_stocks     │
         │   (Supabase)     │
         │   TTL: 60min     │
         └─────────┬────────┘
                   │
                   │ 5분마다 처리
                   ▼
┌─────────────────────────────────────────────────────┐
│            5분 폴링 (analyze-hot-stocks)             │
│                  ⚠️ 베타까지 비활성화                 │
│                                                      │
│  1. 활성 hot stocks 조회                              │
│  2. 만료된 종목 정리 (demote)                          │
│  3. Hot stocks 관련 공시만 수집                        │
│  4. Groq 분석 (우선 처리)                              │
│  5. 트리거 유효성 재확인                                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 트리거 조건

### 1. 가격 급변동 (Price Spike)

```typescript
// 예시: 삼성전자가 5분 내 +7.5% 상승
detectPriceSpike('00126380', '005930', 5.0)
// → { isSpike: true, changePercent: 7.5, threshold: 5.0 }

// 승격
promoteToHotStock(
  '00126380',
  '005930',
  '삼성전자',
  'price_spike',
  '+7.5% in 5min',
  7.5,
  5.0
)
```

**구현 상태**: 🚧 TODO (가격 데이터 파이프라인 필요)

### 2. 거래량 급증 (Volume Spike)

```typescript
// 예시: SK하이닉스 거래량이 5일 평균 대비 3.2배
detectVolumeSpike('00164779', '000660', 2.0)
// → { isSpike: true, volumeRatio: 3.2, threshold: 2.0 }

// 승격
promoteToHotStock(
  '00164779',
  '000660',
  'SK하이닉스',
  'volume_spike',
  '3.2x average volume',
  3.2,
  2.0
)
```

**구현 상태**: 🚧 TODO (거래량 데이터 파이프라인 필요)

### 3. 중요 공시 (Important Disclosure)

```typescript
// 예시: 네이버에 중대한 공시 발생
detectImportantDisclosure('00126380')
// → true (importance='high' or sentiment_score > 0.5)

// 승격
promoteToHotStock(
  '00126380',
  '035420',
  '네이버',
  'important_disclosure',
  'High importance disclosure detected'
)
```

**구현 상태**: ✅ 구현 완료

---

## 파일 구조

```
/supabase/
  ├── hot_stocks_table.sql     # Hot stocks 테이블 + 함수

/lib/
  ├── hot-stocks.ts            # 트리거 감지 & 관리 유틸리티

/app/api/cron/
  ├── analyze-disclosures/     # 15분 폴링 (hot stock 승격 포함)
  └── analyze-hot-stocks/      # 5분 폴링 (비활성화)

/docs/
  └── HYBRID_POLLING.md        # 본 문서
```

---

## 사용 방법

### 1. Supabase 테이블 생성

```bash
# 1. hot_stocks_table.sql 실행
psql -U postgres -d your_database < supabase/hot_stocks_table.sql
```

또는 Supabase Dashboard → SQL Editor:

```sql
-- supabase/hot_stocks_table.sql 내용 복사 & 실행
```

### 2. 환경 변수 설정 (베타 서비스 시)

`.env.local`:

```bash
# Hot stocks 기능 활성화 (기본: false)
ENABLE_HOT_STOCKS=true
```

Vercel Dashboard → Settings → Environment Variables:

```
ENABLE_HOT_STOCKS = true
```

### 3. Vercel Cron 설정 (베타 서비스 시)

#### analyze-hot-stocks (5분 폴링)

- **URL**: `/api/cron/analyze-hot-stocks`
- **Schedule**: `*/5 * * * *` (5분마다)
- **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`

현재 cron 설정 (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/analyze-disclosures",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/cleanup-hashes",
      "schedule": "0 0 * * *"
    }
    // TODO: 베타 서비스 시 추가
    // {
    //   "path": "/api/cron/analyze-hot-stocks",
    //   "schedule": "*/5 * * * *"
    // }
  ]
}
```

---

## 코드 예시

### Hot Stock 승격

```typescript
import { checkHotStockTriggers, promoteToHotStock } from '@/lib/hot-stocks';

// 트리거 확인
const trigger = await checkHotStockTriggers(
  '00126380',  // corp_code
  '005930',    // stock_code
  '삼성전자'    // corp_name
);

if (trigger.shouldPromote) {
  await promoteToHotStock(
    '00126380',
    '005930',
    '삼성전자',
    trigger.reason!,
    trigger.reasonDetail,
    trigger.triggerValue,
    trigger.triggerThreshold
  );
}
```

### 활성 Hot Stocks 조회

```typescript
import { getActiveHotStocks } from '@/lib/hot-stocks';

const hotStocks = await getActiveHotStocks();

hotStocks.forEach(stock => {
  console.log(`🔥 ${stock.corp_name}: ${stock.reason}`);
  console.log(`   Expires: ${stock.expires_at}`);
});
```

### Hot Stock 여부 확인

```typescript
import { isHotStock } from '@/lib/hot-stocks';

const isHot = await isHotStock('00126380');

if (isHot) {
  console.log('🔥 This stock is currently hot!');
}
```

### 만료된 Hot Stocks 정리

```typescript
import { demoteExpiredHotStocks } from '@/lib/hot-stocks';

const demotedCount = await demoteExpiredHotStocks();
console.log(`📉 Demoted ${demotedCount} expired hot stocks`);
```

### 통계 조회

```typescript
import { getHotStockStatistics } from '@/lib/hot-stocks';

const stats = await getHotStockStatistics();

console.log(`
Active: ${stats.active_count}
Demoted: ${stats.demoted_count}
Price spikes: ${stats.price_spike_count}
Volume spikes: ${stats.volume_spike_count}
Disclosures: ${stats.disclosure_count}
Avg refreshes: ${stats.avg_refreshes}
`);
```

---

## 데이터베이스 함수

### promote_to_hot_stock()

종목을 hot stocks로 승격 (또는 TTL 갱신)

```sql
SELECT promote_to_hot_stock(
  '00126380',           -- corp_code
  '005930',             -- stock_code
  '삼성전자',            -- corp_name
  'price_spike',        -- reason
  '+7.5% in 5min',      -- reason_detail
  7.5,                  -- trigger_value
  5.0                   -- trigger_threshold
);
```

### is_hot_stock()

종목이 현재 hot인지 확인

```sql
SELECT is_hot_stock('00126380');
-- → true or false
```

### demote_expired_hot_stocks()

만료된 hot stocks 정리

```sql
SELECT demote_expired_hot_stocks();
-- → 3 (demoted count)
```

### get_active_hot_stocks()

활성 hot stocks 목록

```sql
SELECT * FROM get_active_hot_stocks();
```

---

## 비용 효과

### 시나리오: 2,500개 종목

#### 전체 5분 폴링 (비현실적)

- **크론 호출**: 288회/일
- **DART 조회**: 720,000회/일
- **Groq 분석**: ~50,000회/일
- **월 비용**: ~$500

#### 전체 15분 폴링 (현재)

- **크론 호출**: 96회/일
- **DART 조회**: 240,000회/일
- **Groq 분석**: ~15,000회/일
- **월 비용**: ~$150

#### 하이브리드 폴링 (베타)

- **15분 폴링**: 2,480개 종목
- **5분 폴링**: 20개 hot stocks
- **DART 조회**: 245,000회/일 (+2%)
- **Groq 분석**: ~16,000회/일 (+7%)
- **월 비용**: ~$160

**결론**: 비용은 거의 동일하지만, **중요 종목 모니터링 속도 3배 향상**

---

## 성능 메트릭

### 반응 속도

| 이벤트 | 전체 15분 폴링 | 하이브리드 |
|--------|---------------|-----------|
| 급등락 공시 | 최대 15분 | **최대 5분** |
| 일반 공시 | 최대 15분 | 최대 15분 |
| Hot stock TTL | N/A | 60분 (갱신 가능) |

### 자원 사용

| 항목 | 전체 15분 폴링 | 하이브리드 |
|------|---------------|-----------|
| Cron 호출 | 96/일 | **384/일** (+300%) |
| DART API | 240k/일 | **245k/일** (+2%) |
| Groq 토큰 | 15k/일 | **16k/일** (+7%) |

**트레이드오프**: 크론 호출은 증가하지만, 실제 분석량은 거의 동일 (sharding + hash 전략 덕분)

---

## 모니터링

### Supabase Dashboard

```sql
-- Hot stocks 현황
SELECT * FROM hot_stocks WHERE is_active = TRUE;

-- 통계
SELECT * FROM hot_stocks_statistics;

-- 최근 승격
SELECT
  corp_name,
  reason,
  reason_detail,
  promoted_at,
  expires_at
FROM hot_stocks
WHERE is_active = TRUE
ORDER BY promoted_at DESC;

-- 갱신 횟수 분포
SELECT
  refresh_count,
  COUNT(*) as count
FROM hot_stocks
WHERE is_active = TRUE
GROUP BY refresh_count
ORDER BY refresh_count;
```

### Vercel Logs

```bash
# analyze-hot-stocks cron 로그
vercel logs --since 1h | grep "Hot stocks"

# 승격 이벤트
vercel logs --since 1h | grep "Promoted.*to hot stock"

# 트리거 감지
vercel logs --since 1h | grep "Trigger"
```

---

## 베타 서비스 체크리스트

### 활성화 전 확인 사항

- [ ] `ENABLE_HOT_STOCKS=true` 환경 변수 설정
- [ ] Vercel cron에 `analyze-hot-stocks` 추가
- [ ] Supabase `hot_stocks` 테이블 생성 확인
- [ ] 가격 데이터 파이프라인 구축 (선택)
- [ ] 거래량 데이터 파이프라인 구축 (선택)
- [ ] 모니터링 대시보드 설정

### 활성화 순서

1. 먼저 중요 공시만 사용 (현재 구현)
2. 가격/거래량 파이프라인 완성 후 추가
3. 2주 베타 테스트
4. 정식 서비스 전환

---

## FAQ

### Q: Hot stocks는 자동으로 해제되나요?

A: 네. TTL이 만료되거나 갱신 횟수가 5회를 초과하면 자동으로 15분 폴링으로 복귀합니다.

### Q: 20개 이상 hot stocks가 발생하면?

A: 가장 오래된 종목이 자동으로 해제됩니다. (TODO: 구현 필요)

### Q: 가격/거래량 데이터는 어디서 가져오나요?

A: 현재는 구현되지 않았습니다. 베타 서비스 시 다음 옵션 고려:
- KRX API
- Yahoo Finance API
- 증권사 API (한국투자증권, 키움증권 등)

### Q: 5분 폴링이 너무 자주 아닌가요?

A: Hot stocks는 최대 20개로 제한되므로, 실제 API 부하는 미미합니다. Sharding + Hash 전략으로 중복 호출도 방지됩니다.

### Q: Sonnet은 hot stocks에 사용되나요?

A: 현재는 비활성화되어 있습니다. 베타 서비스 시 hot stocks에 우선적으로 Sonnet을 사용할 계획입니다.

---

## 로드맵

### Phase 1: 공시 기반 (현재)

- ✅ `hot_stocks` 테이블 스키마
- ✅ 트리거 감지 유틸리티
- ✅ 5분 폴링 cron (비활성화)
- ✅ 15분 폴링에 승격 로직 통합
- ✅ 문서화

### Phase 2: 가격/거래량 (베타)

- 🚧 가격 데이터 파이프라인
- 🚧 거래량 데이터 파이프라인
- 🚧 `detectPriceSpike()` 구현
- 🚧 `detectVolumeSpike()` 구현
- 🚧 5분 폴링 활성화

### Phase 3: Sonnet 통합 (정식 서비스)

- 📋 Hot stocks에 Sonnet 우선 적용
- 📋 Premium summary 생성
- 📋 사용자 알림 시스템
- 📋 Hot stocks 대시보드

---

## 참고 자료

- [Hash Strategy](./HASH_STRATEGY.md) - 중복 방지 전략
- [Sharding Strategy](./SHARDING_STRATEGY.md) - 부하 분산 전략
- [DART API](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001)
- [Groq API](https://console.groq.com/docs)

---

**작성일**: 2026-01-17
**상태**: 베타 준비 완료 (비활성화)
**담당**: K-MarketInsight Dev Team
