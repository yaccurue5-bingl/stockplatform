/**
 * /disclosures/[id]  — 공개 공시 상세 페이지 (Method B: 미끼 상품)
 *
 * - 로그인 불필요 (proxy.ts publicPaths에 /disclosures/ 포함)
 * - 헤드라인 / 이벤트 타입 / 감성 / Impact Score 공개
 * - AI 전문 요약 / 핵심 수치 / 리스크는 블러 처리 → CTA
 * - Next.js revalidate 3600s (공시 데이터는 불변 — 1h 후 재검증)
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import { ArrowLeft, Lock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const revalidate = 3600; // 1h — 불변 데이터

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS: 'Earnings Release',
  CONTRACT: 'Strategic Contract',
  DILUTION: 'Capital Increase',
  BUYBACK:  'Share Buyback',
  MNA:      'M&A / Merger',
  LEGAL:    'Legal / Regulatory',
  CAPEX:    'Capital Investment',
  OTHER:    'Corporate Disclosure',
};

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchDisclosure(id: string) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('disclosure_insights')
    .select(
      'id, corp_name, stock_code, rcept_dt, report_nm, ' +
      'headline, event_type, sentiment, sentiment_score, ' +
      'ai_summary, key_numbers, risk_factors, financial_impact, ' +
      'analysis_status, is_visible'
    )
    .eq('id', id)
    .eq('is_visible', true)
    .eq('analysis_status', 'completed')
    .single();

  if (error || !data) return null;
  return data;
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function SentimentBadge({ sentiment, score }: { sentiment: string; score: number | null }) {
  const s = (sentiment ?? 'NEUTRAL').toUpperCase();
  const styles: Record<string, string> = {
    POSITIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    NEGATIVE: 'bg-red-500/10 text-red-400 border-red-500/30',
    NEUTRAL:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  const Icon = s === 'POSITIVE' ? TrendingUp : s === 'NEGATIVE' ? TrendingDown : Minus;
  const label = (score != null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—');

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${styles[s] ?? styles.NEUTRAL}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

function BlurredSection({ title }: { title: string }) {
  return (
    <div className="relative rounded-xl border border-gray-800 bg-gray-900/50 p-5 overflow-hidden">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden>
        <div className="h-3 bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-700 rounded w-4/6" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950/60 backdrop-blur-[2px]">
        <Lock size={18} className="text-gray-400" />
        <p className="text-xs text-gray-400 font-medium">Available on Developer & Pro plans</p>
      </div>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function DisclosureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 로그인 상태이면 전체 공시 목록으로 이동 (블러 반복 방지)
  const user = await getUser();
  if (user) {
    const disclosure = await fetchDisclosure(id);
    const stock = disclosure?.stock_code;
    redirect(stock ? `/disclosures?stock=${stock}` : '/disclosures');
  }

  const disclosure = await fetchDisclosure(id);
  if (!disclosure) notFound();

  const eventLabel = EVENT_LABELS[disclosure.event_type ?? ''] ?? EVENT_LABELS.OTHER;
  const dateStr = disclosure.rcept_dt
    ? `${disclosure.rcept_dt.slice(0, 4)}-${disclosure.rcept_dt.slice(4, 6)}-${disclosure.rcept_dt.slice(6, 8)}`
    : '';

  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      {/* 상단 네비 */}
      <div className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={15} />
            K-Market Insight
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* 헤더 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#00D4A6]">
              {eventLabel}
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-xs text-gray-500">{dateStr}</span>
          </div>

          <h1 className="text-2xl font-bold leading-snug">
            {disclosure.headline ?? disclosure.report_nm ?? 'Corporate Disclosure'}
          </h1>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-300">
                  {(disclosure.corp_name ?? '').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold">{disclosure.corp_name}</p>
                <p className="text-xs text-gray-500">{disclosure.stock_code}</p>
              </div>
            </div>
            <SentimentBadge
              sentiment={disclosure.sentiment ?? 'NEUTRAL'}
              score={disclosure.sentiment_score}
            />
          </div>
        </div>

        {/* 공개 섹션: financial_impact 요약 한 줄 */}
        {disclosure.financial_impact && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">
              Financial Impact
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">{disclosure.financial_impact}</p>
          </div>
        )}

        {/* 블러 섹션 (로그인/플랜 필요) */}
        <BlurredSection title="AI Summary" />
        <BlurredSection title="Key Numbers" />
        <BlurredSection title="Risk Factors" />

        {/* CTA */}
        <div className="rounded-2xl border border-[#00D4A6]/20 bg-[#00D4A6]/5 p-8 text-center space-y-4">
          <p className="text-lg font-bold">Get full AI analysis</p>
          <p className="text-sm text-gray-400">
            Access AI summaries, key financial figures, and risk assessments for every DART disclosure.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={`/login?redirectTo=${encodeURIComponent(`/disclosures/${id}`)}`}
              className="px-6 py-2.5 rounded-full bg-[#00D4A6] text-black text-sm font-semibold hover:bg-[#00bfa0] transition"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2.5 rounded-full border border-gray-700 text-sm font-medium hover:border-gray-500 transition"
            >
              Create account
            </Link>
          </div>
        </div>

        {/* 하단 링크 */}
        <p className="text-center text-xs text-gray-600">
          Already have access?{' '}
          <Link href="/disclosures" className="text-[#00D4A6] hover:underline">
            View all disclosures →
          </Link>
        </p>
      </div>
    </main>
  );
}
