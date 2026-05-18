/**
 * GET /api/cron/trigger-batch?secret=<CRON_SECRET>
 *
 * cron-job.org (GET) → 이 라우트 → GitHub workflow_dispatch (POST)
 * DART prod batch를 외부에서 안전하게 트리거하는 중계 엔드포인트.
 *
 * 환경변수 (Vercel에 설정):
 *   CRON_SECRET   : 임의 문자열 (cron-job.org URL에 포함)
 *   GH_PAT        : GitHub Classic PAT (workflow scope)
 */

import { NextResponse } from 'next/server';

const WORKFLOW_DISPATCH_URL =
  'https://api.github.com/repos/yaccurue5-bingl/stockplatform/actions/workflows/220162531/dispatches';

export const runtime = 'edge';

export async function GET(_request: Request) {
  // cron-job.org 파이프라인 비활성화 — GitHub Actions schedule만 사용
  return NextResponse.json({ ok: false, message: 'cron-job disabled' }, { status: 503 });
}
