# K-MarketInsight 계산식 레퍼런스

> **기준 브랜치**: `claude/dev`  
> **최종 수정**: 2026-04-21  
> 모든 수식은 `scripts/` 폴더 소스코드 기준. 추측·가정 없음.

---

## 목차

1. [BaseScore / FinalScore](#1-basescore--finalscore)
2. [섹터 시그널 (SectorSignal)](#2-섹터-시그널-sectorsignal)
3. [시장 레이더 (MarketRadar)](#3-시장-레이더-marketradar)
4. [백테스트 성과 지표](#4-백테스트-성과-지표)
5. [외국인 순매수 (RISK_ON 레짐)](#5-외국인-순매수-risk_on-레짐)
6. [EOD 파이프라인 실행 순서](#6-eod-파이프라인-실행-순서)
7. [데이터 흐름 다이어그램](#7-데이터-흐름-다이어그램)

---

## 1. BaseScore / FinalScore

**파일**: `scripts/compute_base_score.py`  
**저장 테이블**: `disclosure_insights`, `scores_log`

### 1-1. 입력 데이터

| 입력 | 출처 | 범위 |
|------|------|------|
| `sentiment_score` | `auto_analyst.py` (Groq LLM) | -1.0 ~ +1.0 |
| `short_term_impact_score` | `auto_analyst.py` | 1 ~ 5 (정수) |
| `event_type` | `auto_analyst.py` | 문자열 (예: "CONTRACT_WIN") |
| `avg_5d_return` | `event_stats` 테이블 | % (소수) |
| `sample_size` | `event_stats` 테이블 | 정수 |
| `lps` | `lps_history` 테이블 | 0 ~ 100 (%) |
| `key_numbers` | `auto_analyst.py` | JSON 배열 |

---

### 1-2. 감성 컴포넌트 `s` [0 ~ 40점]

```
s = ((sentiment_score + 1.0) / 2.0) × 40
s = clamp(s, 0, 40)
```

- `sentiment_score = None` → `s = 20.0` (중립 fallback)

| sentiment_score | s |
|-----------------|---|
| -1.0 (매우 부정) | 0.0 |
| 0.0 (중립) | 20.0 |
| +1.0 (매우 긍정) | 40.0 |

---

### 1-3. 중요도 컴포넌트 `i` [0 ~ 30점]

```
i = (short_term_impact_score / 5) × 30
i = clamp(i, 0, 30)
```

- `short_term_impact_score = None` → `i = 15.0` (중립 fallback, 3/5 기준)

| impact_score | i |
|-------------|---|
| 1 | 6.0 |
| 2 | 12.0 |
| 3 | 18.0 |
| 4 | 24.0 |
| 5 | 30.0 |

---

### 1-4. 이벤트 수익률 컴포넌트 `e` [0 ~ 30점]

```
e_full = ((avg_5d_return + 3.0) / 6.0) × 30
e_full = clamp(e_full, 0, 30)

sample_size < 10  → e = 0.0  (통계 불충분)
10 ≤ sample_size < 30 → e = e_full × confidence
  confidence = 0.5 + 0.5 × (sample_size - 10) / 20   # 0.5 → 0.975 선형
sample_size ≥ 30  → e = e_full  (완전 가중치)
```

- `avg_5d_return = None` → `e = 0.0`
- 기준 범위: avg_5d_return = -3% → e = 0 / 0% → e = 15 / +3% → e = 30

| sample_size | confidence | avg_5d_return=+2% 일 때 e |
|-------------|------------|--------------------------|
| < 10 | 0 (제외) | 0.0 |
| 10 | 0.50 | 12.5 |
| 20 | 0.75 | 18.75 |
| 30 이상 | 1.00 | 25.0 |

---

### 1-5. BaseScore (Raw)

```
base_score_raw = s + i + e    (범위: 0 ~ 100)
```

---

### 1-6. BaseScore (Sigmoid 정규화)

```
x = (base_score_raw - 50.0) / 10.0
base_score = sigmoid(x) × 100

sigmoid(x) = 1 / (1 + e^(-x))
x = clamp(x, -500, 500)
```

> 50점 부근에서 선형, 0/100 극단으로 갈수록 수렴.

---

### 1-7. 신뢰도 승수 (Reliability)

```
n = len(key_numbers)  # JSON 배열 항목 수
reliability = min(1.0, 0.5 + n × 0.1)
```

| key_numbers 개수 | reliability |
|----------------|-------------|
| 0 | 0.50 |
| 5 | 1.00 |
| 10 이상 | 1.00 (상한) |

---

### 1-8. FinalScore

```
loan_weight = min(lps / 100.0, 0.40)   # 최대 40% 패널티
final_score = base_score × (1 - loan_weight) × reliability
final_score = clamp(final_score, 0, 100)
```

- `lps = None` → `loan_weight = 0` (패널티 없음)

| lps | loan_weight | base_score=80일 때 final |
|-----|-------------|--------------------------|
| 0% | 0.00 | 80.0 |
| 40% | 0.40 | 48.0 |
| 80% | 0.40 (상한) | 48.0 |

---

### 1-9. Signal Tag

```python
if lps >= 80 and base_score <= 40  → "❌ High Risk Zone"
if lps >= 70 and base_score >= 60  → "⚠️ Smart Money Selling"
if lps <= 20 and base_score >= 70  → "🔥 Short Covering + Momentum"
else                                → None
```

---

## 2. 섹터 시그널 (SectorSignal)

**파일**: `scripts/compute_sector_signals.py`  
**저장 테이블**: `sector_signals`

### 2-1. 입력 데이터

| 입력 | 출처 | 설명 |
|------|------|------|
| `future_return_3d` | `scores_log` | T+3 수익률 (%) |
| `base_score` | `scores_log` | 공시 BaseScore |
| `sector_en` | `companies` | 섹터 분류 |
| `foreign_net_buy_kospi` | `daily_indicators` | 외국인 순매수 (억원) |
| `--days` | CLI 인자 | 집계 기간 (기본 30일) |

---

### 2-2. RISK_ON 날짜 판정

```
직전 3영업일 foreign_net_buy_kospi 합계 > 0  →  해당 공시일 = RISK_ON
직전 3영업일 합계 ≤ 0  →  RISK_OFF
```

---

### 2-3. 섹터별 집계 메트릭

섹터에 속한 공시들을 집계:

```
event_count    = 총 공시 건수
win_rate       = (future_return_3d > 0 인 건수) / event_count
avg_return_3d  = mean(future_return_3d)
risk_on_count  = RISK_ON 날짜의 공시 건수
risk_on_ratio  = risk_on_count / event_count
```

---

### 2-4. 섹터 점수 (SectorScore) [0 ~ 100]

```
normalized_return = (avg_return_3d - min_all) / (max_all - min_all)
  ※ min_all, max_all = 전체 섹터의 avg_return_3d 최솟값/최댓값
  ※ max_all == min_all → normalized_return = 0.5

base_score = win_rate × 60 + normalized_return × 40   # 0 ~ 100

# RISK_ON 레짐 반영
regime_weight = 0.8 + risk_on_ratio × 0.4             # 0.8(risk-off) ~ 1.2(risk-on)
sector_score  = clamp(base_score × regime_weight, 0, 100)
```

**가중치**: 승률 60% + 수익률 상대순위 40% × RISK_ON 레짐 보정

| risk_on_ratio | regime_weight | 효과 |
|--------------|--------------|------|
| 0.0 (전부 RISK-OFF) | 0.80 | score × 0.8 (하향) |
| 0.5 | 1.00 | 변화 없음 |
| 1.0 (전부 RISK-ON) | 1.20 | score × 1.2 (상향, max 100) |

---

### 2-5. 섹터 신호 분류

```
sector_score ≥ 70  →  HIGH_CONVICTION
sector_score ≥ 55  →  CONSTRUCTIVE
sector_score ≥ 40  →  NEUTRAL
sector_score ≥ 25  →  NEGATIVE
sector_score <  25  →  HIGH_RISK
```

---

### 2-6. 신뢰도 (Confidence)

```
confidence = min(1.0, event_count / 20)
```

| event_count | confidence |
|-------------|------------|
| 5 | 0.25 |
| 10 | 0.50 |
| 20 이상 | 1.00 |

---

## 3. 시장 레이더 (MarketRadar)

**파일**: `scripts/compute_market_radar.py`  
**저장 테이블**: `market_radar`

### 3-1. 섹터 신호 → Bullish/Bearish 매핑

```
HIGH_CONVICTION, CONSTRUCTIVE  →  Bullish
NEUTRAL                        →  Neutral
NEGATIVE, HIGH_RISK            →  Bearish
```

---

### 3-2. 시장 신호 (MarketSignal)

```
quality_weight(sector) = disclosure_count × score   # quality-weighted 가중치

bullish_weight = Σ quality_weight  (Bullish 섹터)
bearish_weight = Σ quality_weight  (Bearish 섹터)
total_weight   = Σ quality_weight  (전체 섹터)

bullish_weight / total_weight ≥ 0.50  →  market_signal = "Bullish"
bearish_weight / total_weight ≥ 0.50  →  market_signal = "Bearish"
그 외                                  →  market_signal = "Neutral"
```

> **가중치 기준**: `disclosure_count × score` — 건수만으로는 quantity 편향 발생하므로 sector score로 quality 반영.  
> `score` 없는 섹터는 중립값 50 fallback.

---

### 3-3. 주목 섹터 (TopSector)

```
Bullish 섹터 중 confidence 가장 높은 섹터
Bullish 섹터 없으면 disclosure_count 가장 많은 섹터
```

---

### 3-4. 외국인 순매수 표시 포맷

```
total = foreign_net_buy_kospi + foreign_net_buy_kosdaq
  (한쪽만 있으면 있는 것만 사용)

|total| ≥ 10,000억  →  "±X.X조원"
|total| <  10,000억  →  "±X,XXX억원"
```

---

### 3-5. 저장 컬럼 요약

| 컬럼 | 값 예시 |
|------|---------|
| `market_signal` | `"Bullish"` / `"Bearish"` / `"Neutral"` |
| `top_sector` | `"반도체"` |
| `top_sector_en` | `"Semiconductor"` |
| `foreign_flow` | `"+8,300억원"` / `"-2.0조원"` |
| `kospi_change` | `+1.23` (%) |
| `kosdaq_change` | `-0.45` (%) |
| `total_disclosures` | `2202` |
| `summary` | 한국어 자동 생성 텍스트 |

---

## 4. 백테스트 성과 지표

**파일**: `scripts/compute_backtest.py`  
**전략명**: `event_macro_v1`  
**저장 테이블**: `backtest_trades`, `performance_summary`

### 4-1. 트레이드 필터 조건

```
base_score ≥ 60     (Entry 최소 점수)
future_return_3d IS NOT NULL  (수익률 확정)
```

---

### 4-2. 보유 기간 및 수익률

```
holding_days = "T+3"  (공시일 기준 3영업일)
return = future_return_3d (%)
```

---

### 4-3. 시장 레짐 (MarketRegime)

```
lookback = 직전 3영업일 foreign_net_buy_kospi 합계

합계 > 0  →  RISK_ON
합계 ≤ 0  →  RISK_OFF
데이터 없음  →  RISK_OFF (보수적)
```

---

### 4-4. 성과 지표 계산

**기본 통계**

```
n           = 총 거래 수
avg_return  = mean(return_3d)
std         = 표본 표준편차 = sqrt(Σ(r - avg)² / (n-1))
win_rate    = (return_3d > 0 건수) / n
```

**손익 분석**

```
avg_win    = mean(return_3d > 0)
avg_loss   = mean(return_3d ≤ 0)
loss_rate  = 1 - win_rate
expectancy = win_rate × avg_win - loss_rate × |avg_loss|
```

**샤프 지수**

```
annual_factor = 252 / 3  ≈ 84  (3영업일 보유 → 연간 거래 횟수)

sharpe = (avg_return / std) × sqrt(annual_factor)
       = (avg_return / std) × sqrt(84)
```

- `std = 0`이면 `sharpe = 0`

**최대 낙폭 (Max Drawdown)**

```
equity[0] = 100
equity[t] = equity[t-1] × (1 + return[t] / 100)
peak[t]   = max(equity[0..t])

drawdown[t] = (equity[t] - peak[t]) / peak[t] × 100

max_drawdown = min(drawdown[t])  (음수, 단위 %)
```

**연환산 수익률 (CAGR)**

```
조건: n ≥ 10 AND 기간 ≥ 90일

compound = Π(1 + return[t] / 100)
CAGR = compound^(365 / 기간일수) - 1
annualized_return = CAGR × 100  (%)
```

---

## 5. 외국인 순매수 (RISK_ON 레짐)

**파일**: `scripts/fetch_ecos_foreign_flow.py`, `scripts/backfill_foreign_flow.py`  
**데이터 출처**: 한국은행 ECOS API  
**저장 테이블**: `daily_indicators`

### 5-1. ECOS API 파라미터

| 항목 | 값 |
|------|----|
| stat_code | `802Y001` (1.5.1.1. 주식시장 일별) |
| item_code KOSPI | `0030000` (외국인 순매수 유가증권시장) |
| item_code KOSDAQ | `0113000` (외국인 순매수 코스닥시장) |
| 단위 | 억원 |
| 업데이트 주기 | EOD 배치 (전 영업일 수집) |

---

### 5-2. RISK_ON 판정 (compute_sector_signals / compute_backtest 공통)

```
lookback_dates = 공시일 기준 직전 3영업일
flow_sum = Σ foreign_net_buy_kospi (lookback_dates)

flow_sum > 0  →  RISK_ON
flow_sum ≤ 0  →  RISK_OFF
데이터 없음   →  RISK_OFF
```

---

## 6. EOD 파이프라인 실행 순서

**파일**: `scripts/run_daily_batch.py`  
**실행**: `python scripts/run_daily_batch.py --eod`  
**권장 시각**: KST 16:30 이후

| Step | 스크립트 | 역할 | 실패 시 |
|------|---------|------|---------|
| 1 | `fetch_market_data.py` | 종가·거래량 수집 (KRX) | 후속 스텝 영향 |
| 2 | `fetch_ecos_foreign_flow.py` | 외국인 순매수 KOSPI+KOSDAQ (ECOS) | step 5·6 정확도 저하 |
| 3 | `backfill_scores.py` | AI 분석 누락 건 보완 | 일부 공시 점수 없음 |
| 4 | `compute_base_score.py` | BaseScore·FinalScore 갱신 | step 5·8 영향 |
| 5 | `compute_sector_signals.py` | 섹터 신호 집계 | step 6 영향 |
| 6 | `compute_market_radar.py` | 시장 레이더 집계 | UI MarketRadar 미갱신 |
| 7 | `backfill_prices.py` | T+3/T+5 수익률 백필 | step 8 영향 |
| 8 | `compute_backtest.py` | 백테스트 성과 갱신 | 성과 지표 미갱신 |

---

## 7. 데이터 흐름 다이어그램

```
[공시 원문]
    │
    ▼ auto_analyst.py (Groq LLM)
    │  → sentiment_score (-1 ~ +1)
    │  → short_term_impact_score (1~5)
    │  → event_type
    │  → key_numbers (JSON)
    │
    ▼ compute_base_score.py
    │
    │  s = ((sentiment + 1) / 2) × 40          [0~40]
    │  i = (impact / 5) × 30                   [0~30]
    │  e = ((avg_5d_return + 3) / 6) × 30      [0~30]
    │  raw = s + i + e                          [0~100]
    │  base_score = sigmoid((raw-50)/10) × 100 [0~100]
    │  final_score = base_score × (1-loan_weight) × reliability
    │
    ▼ scores_log 저장
    │
    ├──────────────────────────────────────────────────────┐
    │                                                      │
    ▼ compute_sector_signals.py                            │
    │                                                      │
    │  [섹터별]                                             │
    │  win_rate = 양수 수익 건수 / 전체 건수               │
    │  avg_return_3d = mean(future_return_3d)              │
    │  normalized_return = MinMax 정규화 (전체 섹터 기준)  │
    │  sector_score = win_rate×60 + normalized×40          │
    │                                                      │
    │  ≥70 → HIGH_CONVICTION                               │
    │  ≥55 → CONSTRUCTIVE      ┐ Bullish                   │
    │  ≥40 → NEUTRAL                                       │
    │  ≥25 → NEGATIVE          ┐ Bearish                   │
    │  <25  → HIGH_RISK                                    │
    │                                                      │
    ▼ sector_signals 저장                                  │
    │                                                      │
    ▼ compute_market_radar.py                              │
    │                                                      │
    │  bullish_weight = Σ disclosure_count (Bullish 섹터)  │
    │  bearish_weight = Σ disclosure_count (Bearish 섹터)  │
    │  total_weight   = Σ disclosure_count (전체)          │
    │                                                      │
    │  ≥50% Bullish → market_signal = "Bullish"            │
    │  ≥50% Bearish → market_signal = "Bearish"            │
    │  그 외        → market_signal = "Neutral"            │
    │                                                      │
    ▼ market_radar 저장                                    │
                                                           │
    ▼ compute_backtest.py ◄────────────────────────────────┘
    │
    │  [필터] base_score ≥ 60 AND return_3d IS NOT NULL
    │  [레짐] 직전 3영업일 foreign_net_buy_kospi 합 > 0 → RISK_ON
    │
    │  avg_return  = mean(return_3d)
    │  std         = 표본 표준편차
    │  win_rate    = 양수 수익 비율
    │  sharpe      = (avg / std) × √84
    │  max_dd      = 누적 최대 낙폭
    │  CAGR        = compound^(365/기간일) - 1
    │
    ▼ performance_summary 저장


[ECOS API] → fetch_ecos_foreign_flow.py
    │  stat_code: 802Y001
    │  KOSPI:  item 0030000 (억원)
    │  KOSDAQ: item 0113000 (억원)
    ▼
    daily_indicators 저장
    → compute_sector_signals (RISK_ON 판정)
    → compute_market_radar   (foreign_flow 표시)
    → compute_backtest       (RISK_ON 레짐)
```

---

## 부록: 주요 상수 일람

| 상수 | 값 | 파일 | 설명 |
|------|----|------|------|
| `LPS_DATE_TOLERANCE_DAYS` | 5 | base_score | LPS 조회 허용 오차 (영업일) |
| `RELIABILITY_BASE` | 0.5 | base_score | key_numbers 없을 때 기본 신뢰도 |
| `RELIABILITY_PER_KEY` | 0.1 | base_score | key_numbers 항목당 신뢰도 가산 |
| `LPS_MAX_PENALTY` | 0.40 | base_score | 대차 최대 패널티 비율 |
| `HIGH_CONVICTION_THRESHOLD` | 70 | sector_signals | SectorScore 상한 기준 |
| `CONSTRUCTIVE_THRESHOLD` | 55 | sector_signals | |
| `NEUTRAL_THRESHOLD` | 40 | sector_signals | |
| `NEGATIVE_THRESHOLD` | 25 | sector_signals | |
| `CONFIDENCE_SCALE` | 20 | sector_signals | 공시 20건 = confidence 1.0 |
| `RISK_ON_LOOKBACK_DAYS` | 3 | sector_signals / backtest | 외국인 순매수 합산 기간 |
| `TOP_STOCKS_N` | 5 | sector_signals | 섹터 상위 종목 표시 수 |
| `BULLISH_MAJORITY` | 0.50 | market_radar | Bullish 판정 공시 비율 기준 |
| `BEARISH_MAJORITY` | 0.50 | market_radar | Bearish 판정 공시 비율 기준 |
| `DEFAULT_SCORE_MIN` | 60.0 | backtest | 트레이드 진입 최소 BaseScore |
| `RISK_ON_LOOKBACK` | 3 | backtest | 레짐 판정 소급 영업일 |
| `ANNUAL_FACTOR_3D` | 252/3 ≈ 84 | backtest | 연환산 샤프 계산 인수 |
| `MIN_DAYS_FOR_ANN` | 90 | backtest | CAGR 계산 최소 기간 |
| `ECOS_STAT_CODE` | 802Y001 | fetch_ecos | 한국은행 주식시장 일별 통계 |
| `ECOS_ITEM_KOSPI` | 0030000 | fetch_ecos | 외국인 순매수 유가증권시장 |
| `ECOS_ITEM_KOSDAQ` | 0113000 | fetch_ecos | 외국인 순매수 코스닥시장 |
