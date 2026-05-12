/**
 * /api/bookmarks
 * ==============
 * 북마크 toggle + 상태 조회 API
 *
 * POST { disclosure_id } → { bookmarked: boolean }  (toggle)
 * GET  ?disclosure_id=xxx → { bookmarked: boolean }  (단건 체크)
 * GET  (no param)         → { bookmarks: BookmarkItem[] }  (전체 목록)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase/server';

// ── POST: toggle ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { disclosure_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { disclosure_id } = body;
  if (!disclosure_id || typeof disclosure_id !== 'string') {
    return NextResponse.json({ error: 'disclosure_id required' }, { status: 400 });
  }

  const sb = await createServerClient();

  // 이미 북마크 있으면 삭제, 없으면 추가
  const { data: existingRaw } = await sb
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('disclosure_id', disclosure_id)
    .maybeSingle();

  const existing = existingRaw as { id: string } | null;

  if (existing) {
    await sb.from('bookmarks').delete().eq('id', existing.id);
    return NextResponse.json({ bookmarked: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('bookmarks')
    .insert({ user_id: user.id, disclosure_id });

  if (error) {
    console.error('[bookmarks] insert error:', error);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ bookmarked: true });
}

// ── GET: 체크 또는 목록 ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = await createServerClient();
  const disclosureId = req.nextUrl.searchParams.get('disclosure_id');

  // 단건 체크
  if (disclosureId) {
    const { data } = await sb
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('disclosure_id', disclosureId)
      .maybeSingle();
    return NextResponse.json({ bookmarked: !!data });
  }

  // 전체 목록 (최신순, 최대 200개)
  const { data, error } = await sb
    .from('bookmarks')
    .select(`
      id,
      created_at,
      disclosure_id,
      disclosure_insights (
        id,
        corp_name,
        corp_name_en,
        stock_code,
        headline,
        event_type,
        sentiment_score,
        financial_impact,
        rcept_dt,
        signal_tag
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[bookmarks] list error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }

  return NextResponse.json({ bookmarks: data ?? [] });
}
