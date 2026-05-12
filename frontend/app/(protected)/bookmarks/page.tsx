/**
 * /bookmarks  — 북마크한 공시 목록
 *
 * - 로그인 필수 (middleware에서 /login 리다이렉트)
 * - 모든 플랜 접근 가능 (Free 포함)
 */

import AppShell from '@/components/app/AppShell';
import { getUser, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bookmark, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';

export const metadata = {
  title: 'Bookmarks | K-MarketInsight',
};

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface DisclosureSnap {
  id: string;
  corp_name: string | null;
  corp_name_en: string | null;
  stock_code: string | null;
  headline: string | null;
  event_type: string | null;
  sentiment_score: number | null;
  financial_impact: string | null;
  rcept_dt: string | null;
  signal_tag: string | null;
}

interface BookmarkRow {
  id: string;
  created_at: string;
  disclosure_id: string;
  disclosure_insights: DisclosureSnap | null;
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  EARNINGS:         'text-blue-400 bg-blue-400/10 border-blue-400/20',
  CONTRACT:         'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  DILUTION:         'text-orange-400 bg-orange-400/10 border-orange-400/20',
  BUYBACK:          'text-purple-400 bg-purple-400/10 border-purple-400/20',
  DISPOSAL:         'text-pink-400 bg-pink-400/10 border-pink-400/20',
  DIVIDEND:         'text-teal-400 bg-teal-400/10 border-teal-400/20',
  MNA:              'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  LEGAL:            'text-red-400 bg-red-400/10 border-red-400/20',
  CAPEX:            'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  EXECUTIVE_CHANGE: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  OTHER:            'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

function sentimentIcon(score: number | null) {
  if (score === null) return <Minus size={12} className="text-gray-500" />;
  if (score >= 0.3)  return <TrendingUp size={12} className="text-emerald-400" />;
  if (score <= -0.3) return <TrendingDown size={12} className="text-red-400" />;
  return <Minus size={12} className="text-gray-400" />;
}

function formatDate(rcept_dt: string | null): string {
  if (!rcept_dt || rcept_dt.length < 8) return rcept_dt ?? '';
  return `${rcept_dt.slice(0, 4)}-${rcept_dt.slice(4, 6)}-${rcept_dt.slice(6, 8)}`;
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function BookmarksPage() {
  const user = await getUser();
  if (!user) redirect('/login?redirectTo=/bookmarks');

  const sb = createServiceClient();
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
    console.error('[bookmarks page]', error);
  }

  const bookmarks = ((data ?? []) as unknown as BookmarkRow[]).filter(
    (b) => b.disclosure_insights !== null
  );

  return (
    <AppShell title="Bookmarks" subtitle="Saved disclosure signals">

      {bookmarks.length === 0 ? (
        /* ── 빈 상태 ── */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark size={36} className="text-gray-700 mb-4" />
          <p className="text-sm font-semibold text-gray-400 mb-1">No bookmarks yet</p>
          <p className="text-xs text-gray-600 mb-5">
            Save signals by clicking the bookmark icon on any disclosure page.
          </p>
          <Link
            href="/disclosures"
            className="inline-block px-5 py-2 rounded-full bg-[#00D4A6] text-[#0B0F14] text-xs font-bold hover:bg-[#00bfa0] transition"
          >
            Browse Disclosures →
          </Link>
        </div>
      ) : (
        /* ── 목록 ── */
        <div className="space-y-2">
          <p className="text-xs text-gray-600 mb-4">
            {bookmarks.length} saved signal{bookmarks.length !== 1 ? 's' : ''}
          </p>

          {bookmarks.map((bm) => {
            const di = bm.disclosure_insights!;
            const corp = di.corp_name_en ?? di.corp_name ?? 'Unknown';
            const eventKey = (di.event_type ?? 'OTHER').toUpperCase();
            const eventColor = EVENT_COLORS[eventKey] ?? EVENT_COLORS.OTHER;
            const score = di.sentiment_score;

            return (
              <Link
                key={bm.id}
                href={`/signal/${di.id}`}
                className="group flex items-start gap-4 p-4 bg-[#0d1117] border border-gray-800 rounded-xl hover:border-gray-700 hover:bg-gray-900/50 transition-colors"
              >
                {/* 감성 아이콘 */}
                <div className="mt-0.5 shrink-0">
                  {sentimentIcon(score)}
                </div>

                {/* 메인 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {/* 이벤트 뱃지 */}
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${eventColor}`}>
                      {eventKey}
                    </span>
                    {/* 회사명 */}
                    <span className="text-xs font-semibold text-white truncate">{corp}</span>
                    {di.stock_code && (
                      <span className="text-xs text-gray-600">[{di.stock_code}]</span>
                    )}
                  </div>

                  <p className="text-sm text-gray-300 leading-snug line-clamp-2">
                    {di.headline ?? '(No headline)'}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-600">{formatDate(di.rcept_dt)}</span>
                    {di.signal_tag && (
                      <span className="text-xs text-[#00D4A6] font-medium">{di.signal_tag}</span>
                    )}
                    {score !== null && (
                      <span className={`text-xs font-medium tabular-nums ${
                        score >= 0.3 ? 'text-emerald-400' : score <= -0.3 ? 'text-red-400' : 'text-gray-500'
                      }`}>
                        {score >= 0 ? '+' : ''}{score.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 외부 링크 아이콘 */}
                <ExternalLink
                  size={14}
                  className="text-gray-700 group-hover:text-gray-500 shrink-0 mt-1 transition-colors"
                />
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
