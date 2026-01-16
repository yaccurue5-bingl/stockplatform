# K-MarketInsight MVP - 미완성 TODO 리스트

## 🔴 긴급 (Paddle 승인 후 즉시)

### 1. Vercel 환경 변수 설정
- [ ] PADDLE_VENDOR_ID 추가
- [ ] PADDLE_API_KEY 추가
- [ ] PADDLE_WEBHOOK_SECRET 추가
- [ ] 모든 환경 변수 Production/Preview/Development 적용 확인

### 2. Vercel Cron Jobs 설정
- [ ] `/api/cron/collect-krx` - 평일 오전 9시 (0 9 * * 1-5)
- [ ] `/api/cron/analyze-disclosures` - 평일 오전 10시 (0 10 * * 1-5)
- [ ] Authorization 헤더: Bearer [CRON_SECRET_TOKEN] 설정

### 3. Paddle Webhook URL 등록
- [ ] Paddle Dashboard에서 webhook URL 등록
- [ ] URL: https://your-domain.com/api/paddle/webhook
- [ ] Events 구독: subscription.created, subscription.updated, subscription.canceled, payment.succeeded, payment.failed

---

## 🟡 중요 (데이터 연동)

### 4. API Fetch 유틸리티 구현 ⭐ 최우선
**위치**: `/lib/api/`

- [ ] `lib/api/krx.ts` - KRX 주가 데이터 API
  - [ ] 시장 지수 조회 (KOSPI, KOSDAQ, KRX100)
  - [ ] 종목별 주가 조회
  - [ ] 거래량/거래대금 조회

- [ ] `lib/api/dart.ts` - DART 공시 데이터 API
  - [ ] 최신 공시 목록 조회
  - [ ] 공시 상세 내용 조회
  - [ ] 회사별 공시 필터링

- [ ] `lib/api/groq.ts` - GROQ AI 분석 API
  - [ ] 공시 AI 분석 (감정, 중요도)
  - [ ] 요약 생성
  - [ ] 에러 핸들링

### 5. Cron Jobs 실제 데이터 연동
**현재 상태**: 예제 데이터 사용 중

- [ ] `/api/cron/collect-krx/route.ts` 업데이트
  - [ ] KRX API 호출 구현
  - [ ] 실제 시장 지수 저장
  - [ ] 100개 종목 실시간 업데이트

- [ ] `/api/cron/analyze-disclosures/route.ts` 업데이트
  - [ ] DART API에서 공시 가져오기
  - [ ] GROQ AI 실제 분석 연동
  - [ ] 분석 결과 DB 저장

---

## 🟢 기능 개선

### 6. 대시보드 실제 데이터 연동
**파일**: `/app/(protected)/dashboard/page.tsx`

- [ ] Supabase에서 실제 공시 데이터 가져오기
- [ ] AI 분석 결과 표시
- [ ] 로딩 상태 처리
- [ ] 에러 처리

### 7. Stock 페이지 실제 데이터 연동
**파일**: `/app/stock/[code]/page.tsx`

- [ ] 종목 코드로 데이터 조회
- [ ] 차트 데이터 연동
- [ ] 공시 이력 표시
- [ ] AI 분석 표시

### 8. Paddle 결제 버튼 통합
**파일**: `/app/(marketing)/pricing/page.tsx`

- [ ] Paddle Checkout 초기화
- [ ] "Subscribe" 버튼에 Paddle 연결
- [ ] 결제 성공 후 리다이렉트 처리
- [ ] 결제 실패 처리

---

## 🔵 데이터베이스

### 9. Supabase 테이블 확인/생성

- [ ] `companies` - 상장 기업 정보
- [ ] `market_indices` - 시장 지수
- [ ] `disclosure_insights` - 공시 + AI 분석
- [ ] `subscriptions` - 구독 정보 (Paddle)
- [ ] `payments` - 결제 이력
- [ ] `profiles` - 사용자 프로필

### 10. RLS (Row Level Security) 설정
- [ ] 사용자별 데이터 접근 권한
- [ ] 유료 사용자만 AI 분석 접근
- [ ] 관리자 권한 설정

---

## ⚪ 선택 사항 (나중에)

### 11. 성능 최적화
- [ ] API 응답 캐싱
- [ ] 이미지 최적화
- [ ] Code splitting

### 12. 모니터링
- [ ] Vercel Analytics 설정
- [ ] 에러 트래킹 (Sentry 등)
- [ ] Webhook 로그 모니터링

### 13. 테스트
- [ ] API 엔드포인트 테스트
- [ ] Paddle webhook 테스트
- [ ] Cron job 수동 실행 테스트

---

## 📝 작업 순서

### Phase 1: API 유틸리티 (지금 시작)
1. `lib/api/dart.ts` - DART 공시 API
2. `lib/api/krx.ts` - KRX 시장 데이터 API
3. `lib/api/groq.ts` - AI 분석 API

### Phase 2: 데이터 수집
4. Cron Jobs 실제 API 연동
5. 데이터베이스 스키마 확인

### Phase 3: 프론트엔드 연동
6. 대시보드 실제 데이터 표시
7. Stock 페이지 실제 데이터 표시

### Phase 4: 결제 통합 (Paddle 승인 후)
8. Paddle 결제 버튼
9. Vercel 환경 변수 설정
10. Cron Jobs 설정
