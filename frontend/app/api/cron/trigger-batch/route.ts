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

export async function GET(request: Request) {
  // ── 인증 ──────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pat = process.env.GH_PAT;
  if (!pat) {
    return NextResponse.json({ error: 'GH_PAT not configured' }, { status: 500 });
  }

  // ── GitHub workflow_dispatch 트리거 ────────────────────────────────────────
  const res = await fetch(WORKFLOW_DISPATCH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { mode: 'prod' } }),
  });

  // 204 = 성공 (GitHub는 body 없이 204 반환)
  if (res.status === 204) {
    return NextResponse.json({ ok: true, triggered: new Date().toISOString() });
  }

  const body = await res.text();
  console.error(`[trigger-batch] GitHub API error ${res.status}: ${body}`);
  return NextResponse.json(
    { error: `GitHub API ${res.status}`, detail: body },
    { status: 502 }
  );
}
