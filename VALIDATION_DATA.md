# k-marketinsight 검증 데이터 현황 (2026-04-28)

## 요약

| 섹션 | 상태 | 비고 |
|------|------|------|
| 이벤트 원천 | ✅ 완료 | 17,831건 / 2026-01-18 ~ 2026-04-28 (3.5개월) |
| 가격 데이터 | ⚠️ 부분 | open·close·volume 있음, high·low 없음 |
| 백테스트 결과 | ⚠️ 부분 | return_3d·5d·5d_open·20d 있음, 1d·10d·per-trade benchmark 없음 |
| M_score | ✅ 완료 | 21,040/21,043 백필 완료 (avg 0.9686) |
| F_score | ✅ 완료 | 4,951/21,043 백필 완료 (financials 매칭 종목, avg 55.64) |
| 시장 데이터 | ✅ 완료 | KOSPI·KOSDAQ·외국인·USD/KRW·금리·WTI |
| 섹터 데이터 | ✅ 완료 | 일자별 섹터 signal·confidence·win_rate |

---

## 1. 이벤트 원천 데이터 — `disclosure_insights`

**기간**: 2026-01-18 ~ 2026-04-28 (3.5개월, 요청 6개월 미달)  
**건수**: 17,831건 (`is_visible=true`, `analysis_status='completed'`)

| 요청 필드 | 실제 컬럼 | 비고 |
|-----------|-----------|------|
| event_id | `id` (uuid) | PK |
| stock_code | `stock_code` | KOSPI/KOSDAQ |
| stock_name | `corp_name` / `corp_name_en` | 한글/영문 |
| event_type | `event_type` | EARNINGS·CONTRACT·DILUTION·BUYBACK·MNA·LEGAL·EXECUTIVE_CHANGE·OTHER |
| event_timestamp | `analyzed_at` | 공시수신일: `rcept_dt` (YYYYMMDD) |
| E_score (원본) | `sentiment_score` | -1.0 ~ +1.0, Claude Sonnet 직접 산출 |
| 생성된 요약 | `ai_summary` | LLM output |
| — | `signal_tag` | `{event_type}_{POSITIVE/NEUTRAL/NEGATIVE}` |
| — | `alpha_score` | 통합 알파 스코어 |
| — | `sector` | 18개 KSIC 섹터 |

### 추출 쿼리 (events.csv)
```sql
SELECT id AS event_id, stock_code, corp_name, corp_name_en,
       event_type, rcept_dt AS event_date, analyzed_at,
       sentiment_score AS e_score_raw, sentiment, importance,
       signal_tag, alpha_score, sector, headline, financial_impact, ai_summary
FROM disclosure_insights
WHERE is_visible=true AND analysis_status='completed'
ORDER BY rcept_dt DESC;
```

---

## 2. 가격 데이터 — `price_history`

| 필드 | 상태 | 비고 |
|------|------|------|
| date | ✅ | |
| open | ✅ | |
| close | ✅ | |
| volume | ✅ | |
| high / low | ❌ | 미수집 |
| adjusted price | ⚠️ | KRX raw close 기준 추정, 수정주가 미표기 |

### 추출 쿼리 (prices.csv)
```sql
SELECT ph.stock_code, ph.date, ph.open, ph.close, ph.volume
FROM price_history ph
INNER JOIN (
  SELECT DISTINCT stock_code,
    (TO_DATE(rcept_dt,'YYYYMMDD') - INTERVAL '30 days')::date AS from_dt,
    (TO_DATE(rcept_dt,'YYYYMMDD') + INTERVAL '30 days')::date AS to_dt
  FROM disclosure_insights
  WHERE is_visible=true AND analysis_status='completed'
) ev ON ph.stock_code=ev.stock_code AND ph.date BETWEEN ev.from_dt AND ev.to_dt
ORDER BY ph.stock_code, ph.date;
```

---

## 3. 백테스트 결과 — `scores_log`

| 필드 | 컬럼 | 상태 |
|------|------|------|
| event_id | `disclosure_id` | ✅ |
| return_3d | `future_return_3d` | ✅ |
| return_5d (종가) | `future_return_5d` | ✅ |
| return_5d (D+1 시가) | `future_return_5d_open` | ✅ — lookahead 제거 기준 |
| return_20d | `future_return_20d` | ✅ |
| return_1d / return_10d | — | ❌ — price_history JOIN 후처리로 계산 가능 |
| max_return / max_drawdown | — | ❌ — high/low 없으므로 계산 불가 |
| per-trade benchmark | — | ❌ — daily_indicators JOIN으로 대체 가능 |

### 추출 쿼리 (performance.csv)
```sql
SELECT sl.id, sl.stock_code, sl.date AS event_date, sl.disclosure_id AS event_id,
       sl.base_score_raw, sl.base_score, sl.final_score, sl.alpha_score,
       sl.m_score, sl.f_score, sl.signal_tag,
       sl.future_return_3d AS return_3d,
       sl.future_return_5d AS return_5d_close,
       sl.future_return_5d_open AS return_5d_open,
       sl.future_return_20d AS return_20d,
       di.event_type, di.sentiment_score AS e_score_raw, di.sentiment, di.sector
FROM scores_log sl
LEFT JOIN disclosure_insights di ON sl.disclosure_id=di.id
WHERE sl.future_return_5d_open IS NOT NULL
ORDER BY sl.date DESC;
```

---

## 4. 스코어 구성 요소

### 저장 현황

| 스코어 | 저장 위치 | 백필 현황 | 재현 가능 |
|--------|-----------|-----------|-----------|
| **E_score** | `disclosure_insights.sentiment_score` | ✅ 전체 | ✅ |
| **base_score_raw** | `disclosure_insights`, `scores_log` | ✅ 전체 | ✅ |
| **base_score** | `disclosure_insights`, `scores_log` | ✅ 전체 | ✅ |
| **final_score** | `disclosure_insights`, `scores_log` | ✅ 전체 | ✅ |
| **M_score** | `scores_log.m_score` | ✅ 21,040/21,043 | ✅ |
| **F_score** | `scores_log.f_score` | ✅ 4,951/21,043 | ✅ (financials 매칭 종목) |
| **F_adj** | 미저장 | — | ❌ (vol_pct 사후 재현 불가) |
| **hot_score** | 미저장 | — | ❌ (F_adj 의존) |

### 함수 정의

```
E_score        = sentiment_score ∈ [-1, +1]              (Claude Sonnet LLM 직접 산출)

M_score        = 1 + 0.5 × tanh(z_flow)
  z_flow       = (foreign_net_buy_kospi_t - mean_25d) / std_25d
  source       = daily_indicators.foreign_net_buy_kospi
  range        = [0.5, 1.5]

F_score (0~100) = avg(percentile_rank(지표))
  구성 지표    ROE, 영업이익률, 매출YoY, 영업이익YoY, 부채비율(역순)
  clip 범위    ROE[-5,5]  op_margin[-2,2]  yoy[-3,3]  debt[0,20]
  금융업 제외  매출/영업 지표 제외, ROE+부채비율만 사용
  최소 종목    20개 미만이면 해당 지표 skip

base_score_raw = s + i + e        (0~100)
  s = ((sentiment_score+1)/2) × 40
  i = (short_term_impact_score/5) × 30
  e = clip(z_bucket, -3, 3) 기반 Z-score 백분위 × 30
base_score     = clamp(base_score_raw, 0, 100)
final_score    = base_score × (1 - min(lps/100, 0.4))
```

### F_adj 재현 불가 이유

`F_adj = 0.6 × vol_pct + 0.4 × fin_pct` 에서  
`vol_pct` = API 호출 시점 후보군의 실시간 cross-sectional 거래량 백분위.  
후보군은 매 호출마다 달라지며 사후 재구성 불가 → **F_adj·hot_score는 캡처 시점 없으면 영구 유실**.

---

## 5. 시장 데이터 — `daily_indicators`

| 컬럼 | 설명 |
|------|------|
| `date` | 일자 |
| `kospi_close` / `kospi_change_pct` | KOSPI 종가·등락률 |
| `kosdaq_close` / `kosdaq_change_pct` | KOSDAQ 종가·등락률 |
| `foreign_net_buy_kospi` / `_kosdaq` | 외국인 순매수 (억원) |
| `usd_krw` | 환율 |
| `treasury_yield_3y` / `_10y` | 국고채 3·10년 금리 |
| `wti_oil` | WTI 유가 |

---

## 6. 섹터 데이터 — `sector_signals`

일자별 섹터 signal·confidence·disclosure_count·avg_return_3d·win_rate·risk_on_ratio 보유.

---

## 7. 데이터 정합성 체크

| 조건 | 상태 |
|------|------|
| event_timestamp < price_data timestamp | ✅ `future_return_5d_open` = D+1 시가 기준 (당일 close 미사용) |
| 미래 데이터 사용 금지 | ✅ D+1 open return 기준 확인 |
| 중복 event_id | ✅ `upsert on_conflict=stock_code,date,disclosure_id` |

---

## 8. 출력 파일 구성

| 파일 | 소스 | 주요 컬럼 |
|------|------|-----------|
| `events.csv` | `disclosure_insights` | event_id, stock_code, event_type, e_score_raw, ai_summary |
| `prices.csv` | `price_history` | stock_code, date, open, close, volume |
| `performance.csv` | `scores_log` JOIN `disclosure_insights` | event_id, m_score, f_score, return_3d/5d/20d |
| `market.csv` | `daily_indicators` | date, kospi, kosdaq, foreign_flow |
| `sectors.csv` | `sector_signals` | date, sector, signal, win_rate |

---

## 9. 실측 검증 결과 (2026-04-28 기준)

### 9-1. Final Score 상위 10% vs 하위 10% 수익률

| 그룹 | N | 평균 5d수익(D+1시가) | 표준편차 | Win Rate |
|------|---|---------------------|----------|----------|
| Top 10% (high final_score) | 1,346 | **+1.80%** | 11.11% | **52.7%** |
| Bottom 10% (low final_score) | 1,345 | +1.27% | 11.93% | 48.6% |

> 스프레드 +0.52%, Win Rate 차이 4.1%p. 방향성은 맞으나 spread가 협소함.  
> 전체 평균 수익이 양수인 것은 2026년 1~4월 시장 전반 상승 구간 효과 포함.

---

### 9-2. E_score (sentiment_score) 구간별 수익률

| E_score 구간 | N | 평균 5d수익 | Win Rate | 해석 |
|-------------|---|------------|----------|------|
| Strong Positive (≥0.5) | 1,353 | **+2.01%** | 53.2% | ✅ 최고 |
| Positive (0.2~0.5) | 78 | **-1.68%** | 37.2% | ⚠️ 이상값 — 표본 소규모 |
| Neutral (-0.2~0.2) | 10,682 | +1.90% | 52.5% | 대다수 |
| Negative (-0.5~-0.2) | 691 | +2.19% | 52.5% | ⚠️ 단조성 불일치 |
| Strong Negative (<-0.5) | 649 | +1.38% | 50.2% | |

> **E_score 단독으로는 단조 예측력 없음.** Strong Positive가 최고 수익을 보이나  
> Negative 구간이 Positive 구간보다 높은 수익을 기록. 원인:  
> 1) 데이터 기간 3.5개월 — 통계적 유의성 부족  
> 2) E_score는 공시 감성 평가 목적, 5일 가격 예측 최적화 아님  
> 3) DILUTION(희석) 등 음성 이벤트가 단기 강세를 보이는 한국시장 특성

---

### 9-3. M_score 구간별 수익률 (시장 모멘텀 효과)

| M_score 구간 | N | 평균 5d수익 | Win Rate |
|-------------|---|------------|----------|
| Bull (≥1.2) | 4,505 | **+3.14%** | **60.3%** |
| Bear (<0.9) | 5,858 | +1.58% | 51.0% |
| Neutral (0.9~1.2) | 3,090 | +0.62% | 43.6% |

> M_score는 Bull 구간에서 수익·승률 모두 명확히 개선. **E보다 예측 신호 더 강함**.  
> Neutral이 Bear보다 낮은 것은 외국인 순매수가 0 근처일 때 종목 선택 환경 불리함을 반영.

---

### 9-4. 이벤트 유형별 수익률 (avg 5d D+1시가)

| event_type | N | avg_r5_open | Win Rate | avg_M | avg_F |
|------------|---|------------|----------|-------|-------|
| DILUTION | 1,520 | **+4.66%** | 60.9% | 0.940 | 61.4 |
| CONTRACT | 370 | +3.63% | 56.2% | 0.951 | 59.9 |
| BUYBACK | 250 | +2.68% | 53.6% | 0.956 | 57.1 |
| LEGAL | 147 | +1.92% | 53.7% | 0.980 | 46.5 |
| OTHER | 8,198 | +1.49% | 51.7% | 0.974 | 56.4 |
| EARNINGS | 2,567 | +1.31% | 49.8% | 0.974 | 54.5 |
| MNA | 324 | +0.60% | 47.5% | 0.923 | 55.0 |
| STRUCTURAL | 37 | -0.93% | 24.3% | 1.079 | 55.8 |

> DILUTION 이벤트가 최고 수익 — 한국시장에서 유증은 성장성 자금 조달 성격이 강해  
> 단기 양의 반응 발생 가능. 장기 희석 효과와 단기 반응은 구분 필요.  
> STRUCTURAL(구조적 변경) 은 유일하게 음수 수익·Win Rate 24% → 회피 대상.

---

## 10. 검증 목표별 결론

| 검증 목표 | 결론 |
|-----------|------|
| E_score ↔ 실제 수익 상관관계 | ⚠️ **약함** — Strong Positive 최고이나 단조성 없음. 3.5개월 기간 제약 |
| M_score가 alpha 개선하는지 | ✅ **있음** — Bull 구간 Win Rate +8.7%p (60.3% vs 51.6% 전체 평균) |
| F_score 효과 | ⚠️ **미검증** — 4,951건만 매칭, 전체의 23.5%. 추가 분기 데이터 필요 |
| 전략이 랜덤 대비 우월한지 | ⚠️ **부분적** — Top 10% vs Bottom 10% 스프레드 존재하나 통계적 유의성 낮음 |

---

## 11. 갭 요약

| 갭 | 우선순위 | 권고 |
|----|----------|------|
| 기간 3.5개월 (6개월 미달) | 🔴 | 과거 DART 소급 수집 또는 기간 요건 완화 |
| F_score 매칭률 23.5% | 🔴 | fetch_financial_bulk.py 범위 확대 (미매칭 종목 추가 수집) |
| E_score 단조성 부재 | 🟡 | 더 긴 기간 확보 후 재검증. 가중치 튜닝 검토 |
| F_adj / hot_score 미저장 | 🟡 | API 응답 시 스냅샷 테이블에 기록하는 구조 필요 |
| return_1d·10d 없음 | 🟢 | price_history JOIN 후처리로 계산 가능 |
| price_history에 high·low 없음 | 🟢 | max_return은 close 기준 대체 또는 KRX OHLC 재수집 |
