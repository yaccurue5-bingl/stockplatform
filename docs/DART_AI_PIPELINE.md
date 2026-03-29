# DART AI 분석 파이프라인

공시 수집(`dart_crawler.py`) → Groq AI 분석(`auto_analyst.py`) 전 과정의 프롬프트, 본문 압축 로직, 필터링 조건을 기술합니다.

---

## 1. 본문 수집 & 8000자 압축

### 흐름

```
DART API list.json (당일 공시 목록)
  └─► document.xml (ZIP 다운로드)  ─► 성공: HTML 정제 → [:8000]
         │ 실패 (status=014, 파일 없음)
         └─► DART 웹 뷰어 스크래핑 폴백  ─► 성공: HTML 정제 → [:2500]
                                           실패: "CONTENT_NOT_AVAILABLE"
```

### HTML 정제 (`_clean_html_text`)

| 단계 | 처리 내용 |
|------|-----------|
| 1 | `<style>`, `<script>`, `<head>` 블록 전체 제거 (DOTALL) |
| 2 | 나머지 모든 HTML 태그 제거 |
| 3 | Null 문자 (`\x00`, `\u0000`) 제거 |
| 4 | 연속 공백·줄바꿈 → 단일 공백으로 정규화 |

### 잘라내기 기준

| 수집 경로 | 최대 글자 수 |
|-----------|-------------|
| document.xml (ZIP) — 정상 경로 | **8,000자** |
| DART 뷰어 스크래핑 — 폴백 경로 | **2,500자** |

> **왜 8000자?**
> Groq `llama-3.3-70b-versatile` 모델의 max_completion_tokens=1200 기준으로,
> 입력 컨텍스트 낭비 없이 핵심 재무 수치를 포함하는 경험적 상한선.

---

## 2. 공시 유형 필터링 (8가지)

`classify_disclosure(report_nm)` — 보고서명(title)의 키워드로 1차 분류.

| 유형 | 코드 | 매칭 키워드 | 대표 공시 |
|------|------|------------|-----------|
| 실적 발표 | `EARNINGS` | `분기`, `사업보고서`, `잠정` | 사업보고서, 분기보고서, 잠정실적 |
| 계약·수주 | `CONTRACT` | `단일판매`, `공급계약` | 단일판매·공급계약 체결 |
| 희석 이벤트 | `DILUTION` | `전환사채`, `bw`, `유상증자` | 유상증자결정, CB/BW 발행 |
| 자사주 | `BUYBACK` | `자기주식` | 자기주식 취득·처분·소각 결정 |
| M&A·분할 | `MNA` | `합병`, `분할`, `지분` | 합병, 영업양수도, 지분 취득 |
| 법적 이슈 | `LEGAL` | `소송`, `횡령`, `배임` | 소송 제기, 과징금, 수사 |
| 설비투자 | `CAPEX` | `신규시설`, `투자` | 신규시설투자, 공장 증설 |
| 기타 | `OTHER` | (위 조건 미해당) | 임원 변경, 주주총회 등 |

> **우선순위**: 위 순서대로 첫 번째 매칭 유형을 사용 (`if/elif` 구조).
> 키워드는 `title.lower()`로 소문자 변환 후 비교.

---

## 3. Groq 분석 프롬프트

### 모델 설정

| 항목 | 값 |
|------|----|
| 모델 | `llama-3.3-70b-versatile` |
| Temperature | `0.2` |
| Max completion tokens | `1,200` |
| Response format | `json_object` |

---

### 3-1. Core System Prompt (공통)

```
You are a professional Global financial analyst specializing in Korean DART disclosures.
Your task is to provide a numeric-heavy, objective analysis in English.

STRICT RULES:
1. LANGUAGE: All output values must be in English.
   - Convert Korean units: "원" → "KRW", "주" → "Shares", "억원" → "100M KRW"
   - Translation examples: "매출액" → "Revenue", "영업이익" → "Operating Profit"

2. UNIVERSAL DATA MINER:
   - Scan the entire text to extract all available financial figures (KRW, %, Date, Shares)
   - Priority keywords: Acquisition/Disposal amount, Dividend(yield), Revenue/Profit variance,
     Issuance price, Funding size
   - If the text looks like a broken table, reconstruct the context to find the correct value-unit pair

3. [key_numbers] SECTION:
   - List at least 3-5 most critical financial figures found in the content
   - Format: "• [Item Name]: [Value][Unit] (Comparison/Date/Note)"
   - Never leave this empty. If no numbers, use title information

4. COMPACT SUMMARY:
   - 'ai_summary' must be within 500 characters in English
   - Strictly follow: [Context] → [Key Figures] → [Investment Opinion/Risk]
   - Eliminate filler phrases like "Content not available"

5. [report_nm] TRANSLATION GUIDE:
   - '주요사항보고서'                              → 'Material Fact Report'
   - '기재정정'                                    → '[Amendment]' (앞에 붙임)
   - '자기주식처분결정'                            → 'Decision on Treasury Stock Disposal'
   - '자기주식취득결정'                            → 'Decision on Treasury Stock Acquisition'
   - '유상증자결정'                                → 'Decision on Paid-in Capital Increase'
   - '전환사채권발행결정'                          → 'Decision on Issuance of Convertible Bonds'
   - '신주인수권부사채권발행결정'                  → 'Decision on Issuance of Bonds with Warrants'
   - '현금·현물배당결정'                           → 'Decision on Cash and Property Dividend'
   - '주식등의대량보유상황보고서'                  → 'Large Shareholding Report'
   - '임원ㆍ주요주주특정증권등소유상황보고서'      → 'Report on Shareholding Status of Executives and Major Shareholders'
   - '사업보고서 / 분기보고서 / 반기보고서'        → 'Annual Report / Quarterly Report / Half-yearly Report'
   - '결산실적공시'                                → 'Earnings Release'
```

---

### 3-2. JSON 출력 스키마

```json
{
  "report_nm":               "한국어 보고서명의 영문 전문 금융 제목",
  "headline":                "핵심 요약 (영문, 50자 이내)",
  "key_numbers": [
    "• 핵심 수치 1 (단위 포함)",
    "• 핵심 수치 2 (단위 포함)",
    "• 핵심 수치 3 (단위 포함)"
  ],
  "event_type":              "EARNINGS | CONTRACT | DILUTION | BUYBACK | MNA | LEGAL | CAPEX | OTHER",
  "financial_impact":        "POSITIVE | NEGATIVE | NEUTRAL",
  "short_term_impact_score": 1~5,
  "sentiment_score":         -1.0 ~ +1.0,
  "ai_summary":              "수치 중심 투자 분석 (영문, 500자 이내)",
  "risk_factors":            "주요 리스크 요인 (영문)"
}
```

---

### 3-3. Event Type 가이드

| 코드 | 해당 공시 유형 |
|------|---------------|
| `EARNINGS` | 실적 발표, 사업/분기/반기 보고서, 결산 공시 |
| `CONTRACT` | 수주, 대규모 계약, MOU, 공급계약 |
| `DILUTION` | 유상증자, CB(전환사채), BW(신주인수권부사채) 발행 |
| `BUYBACK`  | 자기주식 취득 또는 소각 결정 |
| `MNA`      | 합병, 인수, 분할, 지분 취득 |
| `LEGAL`    | 소송, 규제 조치, 과징금, 수사 |
| `CAPEX`    | 설비투자, 공장 신증설, R&D 투자 |
| `OTHER`    | 위 어느 항목에도 해당하지 않는 공시 |

---

### 3-4. Sentiment Score 가이드

연속 float (`-1.0` ~ `+1.0`). JSON number 타입 필수 (문자열 금지).

| 범위 | 해석 | 예시 |
|------|------|------|
| `+0.7 ~ +1.0` | 강한 강세 | 실적 대폭 상회, 대형 수주 |
| `+0.2 ~ +0.5` | 소폭 긍정 | 소규모 자사주 매입, 소형 계약 |
| `-0.1 ~ +0.1` | 중립·모호 | 정기 보고서, 구조조정 |
| `-0.4 ~ -0.7` | 소폭 부정 | CB/BW 발행(희석), 법적 이슈 |
| `-0.8 ~ -1.0` | 강한 약세 | 대형 횡령·사기, 대규모 손실 |

---

### 3-5. 유형별 추가 분석 규칙 (Type Rules)

공통 Core Prompt에 해당 유형 규칙이 **추가(append)** 됩니다.

#### EARNINGS
```
- Must include YoY and QoQ growth rates.
- Separate analysis for Operating Profit and Net Income.
- Identify one-off factors and changes in cash flow or debt ratio.
```

#### CONTRACT
```
- Calculate the contract value as a % of recent annual revenue.
- Specify the contract duration and recognition period.
- Distinguish between new and recurring contracts.
```

#### DILUTION
```
- Include number of shares and conversion price.
- Estimate maximum dilution rate.
- Analyze impact on existing shareholder value and purpose of funds.
```

#### BUYBACK
```
- Specify acquisition amount and period.
- Calculate the ratio against total outstanding shares.
- Note whether shares will be cancelled (retired).
```

#### MNA
```
- Specify acquisition/merger amount and its ratio to equity.
- Analyze changes in governance structure and potential financial burden.
```

#### LEGAL
```
- Specify litigation/penalty amounts and impact on capital.
- Assess possibility of loss provisions and reputation risk.
```

#### CAPEX
```
- Specify investment amount and ratio to recent revenue.
- Mention expected payback period and short-term liquidity impact.
```

> `OTHER` 유형은 추가 규칙 없이 Core Prompt만 사용.

---

## 4. 전체 파이프라인 흐름 요약

```
dart_crawler.py
  1. DART list.json → 당일 공시 목록
  2. 중복 체크 (disclosure_hashes)
  3. document.xml ZIP 다운로드
     → _clean_html_text() → [:8000]
     → 실패 시 뷰어 스크래핑 폴백 → [:2500]
  4. disclosure_insights INSERT (analysis_status='pending')

auto_analyst.py
  5. pending 항목 조회 (최대 50건)
  6. classify_disclosure(report_nm) → 8가지 유형 분류
  7. build_prompt() → core_prompt + type_rule 조합
  8. Groq llama-3.3-70b-versatile 호출 (JSON mode)
  9. sentiment_score 파싱 & clamp [-1.0, +1.0]
 10. _compute_scores_inline() → base_score / final_score / signal_tag
 11. disclosure_insights UPDATE (analysis_status='completed')
```

---

## 5. 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/dart_crawler.py` | 공시 수집, 본문 정제, 8000자 압축 |
| `scripts/auto_analyst.py` | Groq 분석, 유형 분류, 프롬프트 생성 |
| `scripts/compute_base_score.py` | base_score / final_score / signal_tag 계산 수식 |
| `backend/routers/v1/events.py` | `/v1/events` API (event_stats + disclosure_insights) |
