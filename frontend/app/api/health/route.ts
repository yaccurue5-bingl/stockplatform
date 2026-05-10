/**
 * GET /api/health
 * 업타임 모니터링 / Playwright E2E용 헬스체크 엔드포인트.
 * 인증 불필요 — proxy.ts publicPaths에 포함 필요 없음 (미들웨어가 /api/* 통과시킴).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'edge';          // 엣지에서 빠르게 응답
export const dynamic = 'force-dynamic'; // 캐시 금지

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  // ── Supabase 연결 확인 ────────────────────────────────────────────────────
  try {
    const supabase = await createServerClient();
    // 최소한의 쿼리로 DB 연결 확인
    const { error } = await supabase
      .from('companies')
      .select('corp_code')
      .limit(1)
      .maybeSingle();

    checks.db = error ? 'error' : 'ok';
  } catch {
    checks.db = 'error';
  }

  const allOk   = Object.values(checks).every((v) => v === 'ok');
  const status  = allOk ? 200 : 503;

  return NextResponse.json(
    {
      ok:        allOk,
      status:    allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version:   process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
