/**
 * /disclosures/[id]  — 공개 공시 상세 페이지 (Method B: 미끼 상품)
 *
 * - 로그인 불필요 (proxy.ts publicPaths에 /disclosures/ 포함)
 * - 헤드라인 / 이벤트 타입 / 감성 / Impact Score 공개
 * - AI 전문 요약 / 핵심 수치 / 리스크는 블러 처리 → CTA
 * - Next.js revalidate 3600s (공시 데이터는 불변 — 1h 후 재검증)
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import { ArrowLeft, Lock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import FinancialRatios from '@/components/disclosures/FinancialRatios';
import DataSourceNote from '@/components/DataSourceNote';

export const revalidate = 3600; // 1h — 불변 데이터

const SITE_URL = 'https://k-marketinsight.com';

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

// ── generateMetadata ──────────────────────────────────────────────────────────
// canonical → /signal/[id] (SEO primary page)
// disclosures/[id] is user-facing (full content when logged in);
// we don't want Google to index it as a separate page from /signal/[id].

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const sb = createServiceClient();
  const { data: raw } = await sb
    .from('disclosure_insights')
    .select('id, corp_name, stock_code, report_nm, report_nm_en, headline, financial_impact, ai_summary, event_type, rcept_dt')
    .eq('id', id)
    .eq('is_visible', true)
    .single();

  if (!raw) return { title: 'Disclosure Not Found | K-MarketInsight' };

  const data = raw as unknown as {
    id: string;
    corp_name: string | null;
    stock_code: string | null;
    report_nm: string | null;
    report_nm_en: string | null;
    headline: string | null;
    financial_impact: string | null;
    ai_summary: string | null;
    event_type: string | null;
    rcept_dt: string | null;
  };

  const title = (data.headline ?? data.report_nm_en ?? data.report_nm ?? 'Corporate Disclosure') +
    ` — ${data.corp_name ?? ''} | K-MarketInsight`;
  const description = (data.financial_impact ?? data.ai_summary ?? '')
    .slice(0, 160) ||
    `${EVENT_LABELS[data.event_type ?? ''] ?? 'Corporate Disclosure'} from ${data.corp_name} (${data.stock_code}). DART filing analysis.`;

  // /signal/[id] is the canonical SEO page — this page defers to it
  const signalUrl = `${SITE_URL}/signal/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: signalUrl,
      siteName: 'K-MarketInsight',
      type: 'article',
    },
    alternates: {
      canonical: signalUrl,
    },
  };
}

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

interface DisclosureRow {
  id: string;
  corp_name: string | null;
  stock_code: string | null;
  rcept_dt: string;
  report_nm: string;
  report_nm_en: string | null;
  headline: string | null;
  event_type: string | null;
  sentiment_score: number | null;
  ai_summary: string | null;
  key_numbers: unknown;
  risk_factors: string | null;
  financial_impact: string | null;
  analysis_status: string | null;
  is_visible: boolean | null;
}

async function fetchDisclosure(id: string): Promise<DisclosureRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('disclosure_insights')
    .select(
      'id, corp_name, stock_code, rcept_dt, report_nm, report_nm_en, ' +
      'headline, event_type, sentiment_score, ' +
      'ai_summary, key_numbers, risk_factors, financial_impact, ' +
      'analysis_status, is_visible'
    )
    .eq('id', id)
    .eq('is_visible', true)
    .eq('analysis_status', 'completed')
    .single();

  if (error || !data) return null;
  return data as unknown as DisclosureRow;
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

  const [disclosure, user] = await Promise.all([fetchDisclosure(id), getUser()]);
  if (!disclosure) notFound();

  const isLoggedIn = !!user;

  const score = disclosure.sentiment_score ?? 0;
  const sentiment = score >= 0.3 ? 'POSITIVE' : score <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';

  const eventLabel = EVENT_LABELS[disclosure.event_type ?? ''] ?? EVENT_LABELS.OTHER;
  const dateStr = disclosure.rcept_dt
    ? `${disclosure.rcept_dt.slice(0, 4)}-${disclosure.rcept_dt.slice(4, 6)}-${disclosure.rcept_dt.slice(6, 8)}`
    : '';

  // key_numbers JSON 파싱
  const keyNums = (() => {
    try {
      const raw = disclosure.key_numbers;
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string>;
      return null;
    } catch { return null; }
  })();

  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      {/* 상단 네비 */}
      <div className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/disclosures"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={15} />
            All Disclosures
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
            {disclosure.headline ?? disclosure.report_nm_en ?? disclosure.report_nm ?? 'Corporate Disclosure'}
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
            <SentimentBadge sentiment={sentiment} score={disclosure.sentiment_score} />
          </div>
        </div>

        {/* Financial Impact (항상 공개) */}
        {disclosure.financial_impact && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">
              Financial Impact
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">{disclosure.financial_impact}</p>
          </div>
        )}

        {/* Financial Ratios YoY (EARNINGS 타입 + 데이터 있을 때만 표시) */}
        <FinancialRatios
          stockCode={disclosure.stock_code ?? ''}
          eventType={disclosure.event_type ?? null}
        />

        {/* ── 로그인 유저: 전체 공개 ── */}
        {isLoggedIn ? (
          <>
            {disclosure.ai_summary && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">AI Summary</p>
                <p className="text-sm text-gray-300 leading-relaxed">{disclosure.ai_summary}</p>
              </div>
            )}

            {keyNums && Object.keys(keyNums).length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">Key Numbers</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(keyNums).map(([k, v]) => (
                    <div key={k} className="bg-gray-800/50 rounded-lg px-4 py-3">
                      <dt className="text-xs text-gray-500 mb-1">{k}</dt>
                      <dd className="text-sm font-semibold text-white">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {disclosure.risk_factors && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">Risk Factors</p>
                <p className="text-sm text-gray-300 leading-relaxed">{disclosure.risk_factors}</p>
              </div>
            )}
          </>
        ) : (
          /* ── 비로그인: 블러 + CTA ── */
          <>
            <BlurredSection title="AI Summary" />
            <BlurredSection title="Key Numbers" />
            <BlurredSection title="Risk Factors" />

            <div className="rounded-2xl border border-[#00D4A6]/20 bg-[#00D4A6]/5 p-8 text-center space-y-4">
              <p className="text-lg font-bold">Get full AI analysis</p>
              <p className="text-sm text-gray-400">
                Access AI summaries, key financial figures, and risk assessments for every DART disclosure.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(
                    disclosure.stock_code
                      ? `/disclosures?stock=${disclosure.stock_code}&disclosure=${id}`
                      : '/disclosures'
                  )}`}
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

            <p className="text-center text-xs text-gray-600">
              Already have access?{' '}
              <Link href="/disclosures" className="text-[#00D4A6] hover:underline">
                View all disclosures →
              </Link>
            </p>
          </>
        )}

        {/* Data Source Attribution */}
        <DataSourceNote
          source="DART"
          reportName={disclosure.report_nm_en ?? disclosure.report_nm}
        />
      </div>
    </main>
  );
}
