/**
 * lib/v1/usage.ts
 * ===============
 * API 호출 로깅 + api_usage_daily 집계 업데이트.
 *
 * 1. api_usage_log  : 상세 로그 (endpoint, status, latency)
 * 2. api_usage_daily: quota 계산용 날짜별 집계
 *
 * 비동기 fire-and-forget — 응답을 블로킹하지 않음.
 */

import { createServiceClient } from '@/lib/supabase/server'

export async function logApiCall(params: {
  userId:     string
  plan:       string
  endpoint:   string
  method?:    string
  statusCode: number
  latencyMs:  number
}): Promise<void> {
  const { userId, plan, endpoint, method = 'GET', statusCode, latencyMs } = params
  const today = new Date().toISOString().slice(0, 10)

  try {
    const sb = createServiceClient()

    // 병렬 실행: 상세 로그 + 집계 upsert
    await Promise.all([
      // 1. 상세 로그
      (sb as any).from('api_usage_log').insert({
        user_id:     userId,
        endpoint,
        method,
        status_code: statusCode,
        latency_ms:  latencyMs,
        plan,
      }),

      // 2. 날짜별 집계 (call_count + 1)
      (sb as any).rpc('increment_usage_daily', {
        p_user_id: userId,
        p_date:    today,
      }),
    ])
  } catch (e) {
    // 로깅 실패가 API 응답에 영향을 주면 안 됨
    console.error('[usage] log error:', e)
  }
}
