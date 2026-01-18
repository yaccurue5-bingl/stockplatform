# 크롤링 모니터링 가이드

## 🎯 크롤링 결과 확인하기

### 방법 1: Supabase에서 직접 확인 (권장) ⭐

1. **Supabase Dashboard** 접속
2. **SQL Editor** 열기
3. **`supabase/monitor_disclosures.sql`** 복사 → 붙여넣기
4. **Run** 클릭

**결과 예시:**
```
📊 전체 통계
• 총 공시: 123건
• 오늘: 45건
• 분석완료: 118건
• 대기중: 5건
• Sonnet 분석: 1건

⏰ 시간대별 현황
14:00 | 23건 | 15개 종목
13:00 | 18건 | 12개 종목
12:00 | 4건  | 4개 종목
```

---

### 방법 2: Cron Job 수동 실행

**즉시 크롤링을 실행하고 결과 확인:**

```bash
cd /home/user/stockplatform/my-research-platform
./scripts/trigger-cron.sh
```

**결과:**
```
✅ 성공 (HTTP 200)
• 전체 공시: 123 건
• 새 공시: 12 건
• 분석 성공: 10 건
• 분석 실패: 2 건
• Sonnet 분석: 1 건
```

---

### 방법 3: 간단한 쿼리로 확인

**Supabase SQL Editor에서 실행:**

```sql
-- 전체 공시 개수
SELECT COUNT(*) as total FROM disclosure_insights;

-- 최근 1시간 공시
SELECT COUNT(*) as last_hour
FROM disclosure_insights
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- 최신 10개 공시
SELECT
  corp_name,
  report_nm,
  importance,
  created_at
FROM disclosure_insights
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 주요 지표 설명

### 1. 크롤링 개수 기준점

**DART API 특성:**
- 15분마다 실행
- 평균 **5~20건** 정도의 새 공시
- 장 시작/종료 시간대: **20~50건** (많음)
- 장외 시간: **0~5건** (적음)
- 긴급공시/대규모공시: 즉시 크롤링

**정상 범위:**
```
• 09:00-15:30 (장중): 10~30건/15분
• 15:30-09:00 (장외): 0~10건/15분
• 주말: 0~5건/15분
```

### 2. 분석 상태

- **pending**: 크롤링 됨, 분석 대기 중
- **completed**: Groq 분석 완료
- **failed**: 분석 실패 (재시도 필요)

**정상 비율:**
- ✅ completed: 90% 이상
- ⏳ pending: 5% 이하
- ❌ failed: 5% 이하

### 3. Sonnet 샘플 분석

- **목표**: 15분마다 1건
- **기준**: 가장 중요한 공시 (HIGH importance + 감정 극단값)
- **확인**: `is_sample_disclosure = TRUE`

---

## 🔧 조정이 필요한 경우

### 크롤링 개수가 너무 많을 때 (50건 이상)

**원인:**
- DART API가 너무 많은 공시를 반환
- 필터링이 부족

**조정:**
```typescript
// app/api/cron/analyze-disclosures/route.ts
const IMPORTANT_KEYWORDS = [
  '대규모', '단일판매', '영업정지', '분할',
  '합병', '자산양수도', '감자', // 추가
];

// 날짜 범위 축소
const fromDate = new Date();
fromDate.setMinutes(fromDate.getMinutes() - 15); // 30분 → 15분으로
```

### 크롤링 개수가 너무 적을 때 (0~2건)

**원인:**
- 장외 시간대 (정상)
- DART API 응답 없음
- 필터링이 너무 강함

**확인:**
1. DART API 응답 확인
2. 키워드 필터링 완화
3. 시간대 확인 (주말/공휴일)

**조정:**
```typescript
// 필터링 완화
const IMPORTANT_KEYWORDS = [
  '대규모', // 다른 키워드 제거
];
```

### Sonnet 분석이 너무 많을 때

**원인:**
- `ENABLE_SONNET_SAMPLE=true`
- 비용 증가 우려

**조정:**
```typescript
// 1시간에 1건으로 제한
const ENABLE_SONNET_SAMPLE = process.env.ENABLE_SONNET_SAMPLE === 'true';
const SONNET_INTERVAL_MINUTES = 60; // 기본: 15분

const lastSonnetAnalysis = await supabase
  .from('disclosure_insights')
  .select('sonnet_analyzed_at')
  .eq('sonnet_analyzed', true)
  .order('sonnet_analyzed_at', { ascending: false })
  .limit(1);

const timeSinceLastSonnet = Date.now() - new Date(lastSonnetAnalysis.data[0]?.sonnet_analyzed_at);
if (timeSinceLastSonnet < SONNET_INTERVAL_MINUTES * 60 * 1000) {
  // Skip Sonnet analysis
}
```

---

## 📈 실시간 모니터링

### Vercel 로그 확인

```bash
# 최근 10분 로그
vercel logs --since 10m

# 실시간 로그
vercel logs --follow

# 특정 함수 로그
vercel logs --since 1h | grep "analyze-disclosures"
```

### 데이터베이스 실시간 확인

**Supabase Dashboard → Table Editor:**
- `disclosure_insights` 테이블 열기
- 필터: `created_at > now() - interval '1 hour'`
- 정렬: `created_at DESC`

---

## 🎯 첫 크롤링 결과 확인 체크리스트

### Step 1: 환경 확인
- [ ] `migrate_safe.sql` 실행 완료
- [ ] Vercel 환경변수 설정 (DART_API_KEY, GROQ_API_KEY 등)
- [ ] Cron Job 활성화

### Step 2: 수동 실행
```bash
./scripts/trigger-cron.sh
```

### Step 3: 결과 확인
```sql
-- supabase/monitor_disclosures.sql 실행
```

### Step 4: 기준점 설정
**예상 결과:**
```
첫 실행: 10~30건 (현재 시간대 공시)
분석 완료: 8~25건 (80~90%)
Sonnet 샘플: 1건
```

**만족스럽지 않으면:**
- 키워드 조정
- 크롤링 간격 조정
- 필터링 로직 수정

---

## 📞 문제 발생 시

### 공시가 0건일 때
1. DART API 키 확인
2. 시간대 확인 (주말/공휴일?)
3. Vercel 로그 확인

### 분석 실패가 많을 때
1. Groq API 키 확인
2. Groq API 할당량 확인
3. 에러 로그 확인

### Sonnet 분석이 안 될 때
1. `ENABLE_SONNET_SAMPLE=true` 확인
2. Anthropic API 키 확인
3. API 할당량 확인

---

결과를 확인한 후 피드백 주시면 최적화해드리겠습니다!
