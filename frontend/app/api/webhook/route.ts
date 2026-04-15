/**
 * /api/webhook  — Paddle Live webhook endpoint
 *
 * Paddle 라이브 대시보드 설정:
 *   Notification URL: https://k-marketinsight.com/api/webhook
 *
 * 실제 처리 로직은 /api/paddle/webhook/route.ts 에서 관리.
 */
export { POST } from '@/app/api/paddle/webhook/route';
