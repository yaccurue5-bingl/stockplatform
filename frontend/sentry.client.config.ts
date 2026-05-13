/**
 * Sentry Client-Side Configuration
 * - App Router 브라우저 에러 캡처
 * - Session Replay (privacy-first: 텍스트/입력값 마스킹)
 * - PII 스크러빙 (auth 토큰, 쿠키, 민감 파라미터 제거)
 * - Production only
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // ── 활성화 조건 ─────────────────────────────────────────────────────────────
  enabled: process.env.NODE_ENV === 'production',

  // ── 성능 트레이싱 ────────────────────────────────────────────────────────────
  // 프로덕션 10% (트래픽 증가 시 5%로 낮출 것)
  tracesSampleRate: 0.1,

  // ── Session Replay ───────────────────────────────────────────────────────────
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,      // 모든 텍스트 마스킹 (이름, 이메일 등 PII)
      maskAllInputs: true,    // 모든 입력값 마스킹 (비밀번호, API 키 등)
      blockAllMedia: true,    // 이미지/비디오 차단
    }),
    Sentry.browserTracingIntegration(),
  ],
  replaysSessionSampleRate: 0.02,   // 정상 세션 2% (저트래픽 → 추후 조정)
  replaysOnErrorSampleRate: 1.0,    // 에러 발생 세션 100%

  // ── PII 보호 ─────────────────────────────────────────────────────────────────
  sendDefaultPii: false, // IP, User-Agent, 기본 요청 헤더 미수집

  beforeSend(event) {
    // 요청 헤더에서 인증 정보 제거
    if (event.request?.headers) {
      const h = { ...event.request.headers };
      for (const k of ['authorization', 'cookie', 'x-api-key', 'x-service-role', 'set-cookie']) {
        delete h[k];
        delete h[k.toUpperCase()];
      }
      event.request.headers = h;
    }
    // URL 쿼리스트링에서 민감 파라미터 마스킹
    if (event.request?.url) {
      event.request.url = event.request.url.replace(
        /([?&](token|key|password|secret|auth|api_key|access_token|refresh_token)=)[^&#]*/gi,
        '$1[REDACTED]',
      );
    }
    return event;
  },

  // ── 무시할 에러 ──────────────────────────────────────────────────────────────
  ignoreErrors: [
    // 브라우저 내부 에러 (액션 없음)
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // 네트워크 에러 (사용자 연결 문제)
    /^Network Error$/,
    /^Failed to fetch$/,
    /^Load failed$/,
    /AbortError/,
    // 번들 청크 로딩 실패 (캐시 미스, 사용자 네트워크)
    /ChunkLoadError/,
    /Loading chunk \d+ failed/,
    // Promise rejection이 Error 객체가 아닌 경우
    'Non-Error promise rejection captured',
    // 광고/써드파티 스크립트 간섭
    /^Cannot redefine property: googletag/,
    /^Blocked a frame with origin/,
  ],

  debug: false,
});
