/**
 * GET /api/disclosures/[id]/full
 * ================================
 * /disclosures/[id] 페이지의 로그인 전용 콘텐츠(AI Summary / Key Numbers / Risk Factors).
 *
 * 이 필드들은 더 이상 페이지 서버 렌더링에서 다루지 않는다 — getUser()를 페이지
 * 렌더 경로에 두면 Next.js가 라우트 전체를 dynamic으로 강제 전환해 revalidate가
 * 무효화되기 때문 (Vercel Fluid Active CPU 100% 소진 원인). 대신 페이지는 항상
 * 비로그인 버전으로 캐싱되고, 로그인 유저만 클라이언트에서 이 라우트를 호출해
 * 잠긴 콘텐츠를 받아온다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, createServiceClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('disclosure_insights')
    .select('ai_summary, key_numbers, risk_factors')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
