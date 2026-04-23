/**
 * /stock/[code] — 종목별 공시 분석 페이지
 *
 * - 로그인 불필요, SEO 인덱싱 대상
 * - 공개: 기업 기본정보, 최근 공시 목록 (headline/event_type/sentiment)
 * - 잠금(CTA): full AI 분석, risk_factors
 * - revalidate: 3600s (EOD 업데이트 주기 기준)
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Minus, Lock, Building2 } from 'lucide-react';

export const revalidate = 3600;

const SITE_URL = 'https://k-marketinsight.com';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS:         'Earnings',
  CONTRACT:         'Contract',
  DILUTION:         'Dilution',
  BUYBACK:          'Buyback',
  MNA:              'M&A',
  LEGAL:            'Legal',
  CAPEX:            'CapEx',
  EXECUTIVE_CHANGE: 'Executive',
  OTHER:            'Disclosure',
};

const EVENT_COLORS: Record<string, string> = {
  EARNINGS:         'text-blue-400 bg-blue-400/10 border-blue-400/20',
  CONTRACT:         'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  DILUTION:         'text-orange-400 bg-orange-400/10 border-orange-400/20',
  BUYBACK:          'text-purple-400 bg-purple-400/10 border-purple-400/20',
  MNA:              'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  LEGAL:            'text-red-400 bg-red-400/10 border-red-400/20',
  CAPEX:            'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  EXECUTIVE_CHANGE: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  OTHER:            'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface CompanyRow {
  corp_name: string;
  stock_code: string;
  sector: string | null;
  sector_en: string | null;
  market_type: string | null;
  market_cap: number | null;
  foreign_ratio: number | null;
  listed_shares: number | null;
  representative: string | null;
}

interface DisclosureRow {
  id: string;
  rcept_no: string | null;
  rcept_dt: string;
  report_nm: string;
  headline: string | null;
  event_type: string | null;
  sentiment_score: number | null;
  financial_impact: string | null;
  base_score: number | null;
  signal_tag: string | null;
}

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchCompany(code: string): Promise<CompanyRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('companies')
    .select('corp_name, stock_code, sector, sector_en, market_type, market_cap, foreign_ratio, listed_shares, representative')
    .eq('stock_code', code)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CompanyRow;
}

async function fetchDisclosures(code: string): Promise<DisclosureRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('disclosure_insights')
    .select('id, rcept_no, rcept_dt, report_nm, headline, event_type, sentiment_score, financial_impact, base_score, signal_tag')
    .eq('stock_code', code)
    .eq('analysis_status', 'completed')
    .eq('is_visible', true)
    .order('rcept_dt', { ascending: false })
    .limit(8);
  if (error) return [];
  return (data ?? []) as unknown as DisclosureRow[];
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDate(rcept_dt: string): string {
  if (!rcept_dt || rcept_dt.length < 8) return rcept_dt;
  return `${rcept_dt.slice(0, 4)}-${rcept_dt.slice(4, 6)}-${rcept_dt.slice(6, 8)}`;
}

function fmtCap(cap: number | null): string {
  if (!cap) return '—';
  if (cap >= 1_000_000) return `₩${(cap / 1_000_000).toFixed(1)}T`;
  if (cap >= 1_000)     return `₩${(cap / 1_000).toFixed(0)}B`;
  return `₩${cap}M`;
}

function deriveSentiment(score: number | null): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  if (score === null) return 'NEUTRAL';
  return score >= 0.3 ? 'POSITIVE' : score <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const company = await fetchCompany(code);

  const corpName = company?.corp_name ?? code;
  const sector   = company?.sector_en ?? company?.sector ?? '';
  const title    = `${corpName} (${code}) DART Disclosure Analysis | K-MarketInsight`;
  const description = `AI-analyzed DART filings for ${corpName}${sector ? ` (${sector})` : ''}. Real-time signal scoring, sentiment analysis and financial impact summary.`;
  const url = `${SITE_URL}/stock/${code}`;

  return {
    title,
    description,
    openGraph: { title, description, url, siteName: 'K-MarketInsight', type: 'website' },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: url },
  };
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function SentimentIcon({ score }: { score: number | null }) {
  const s = deriveSentiment(score);
  if (s === 'POSITIVE') return <TrendingUp size={13} className="text-emerald-400" />;
  if (s === 'NEGATIVE') return <TrendingDown size={13} className="text-red-400" />;
  return <Minus size={13} className="text-gray-500" />;
}

function SentimentBadge({ score }: { score: number | null }) {
  const s = deriveSentiment(score);
  const styles = {
    POSITIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    NEGATIVE: 'bg-red-500/10 text-red-400 border-red-500/30',
    NEUTRAL:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  const label = score !== null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${styles[s]}`}>
      <SentimentIcon score={score} />
      {label}
    </span>
  );
}

function EventBadge({ eventType }: { eventType: string | null }) {
  const key   = (eventType ?? 'OTHER').toUpperCase();
  const label = EVENT_LABELS[key] ?? EVENT_LABELS.OTHER;
  const color = EVENT_COLORS[key] ?? EVENT_COLORS.OTHER;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-base font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function StockPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [company, disclosures] = await Promise.all([
    fetchCompany(code),
    fetchDisclosures(code),
  ]);

  if (!company && disclosures.length === 0) notFound();

  const corpName   = company?.corp_name ?? disclosures[0]?.headline?.split(' ')[0] ?? code;
  const marketType = company?.market_type?.toUpperCase() ?? null;

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Corporation',
    name: corpName,
    tickerSymbol: code,
    url: `${SITE_URL}/stock/${code}`,
    ...(company?.sector_en ? { industry: company.sector_en } : {}),
  };

  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 상단 네비 */}
      <div className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={15} />
            K-MarketInsight
          </Link>
          <Link
            href={`/login?redirectTo=${encodeURIComponent('/disclosures?stock=' + code)}`}
            className="text-xs text-[#00D4A6] hover:underline"
          >
            Sign in for full access →
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* ── 기업 헤더 ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{corpName}</h1>
                <span className="text-sm text-gray-500 font-mono">{code}</span>
                {marketType && (
                  <span className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 font-medium">
                    {marketType}
                  </span>
                )}
              </div>
              {(company?.sector_en ?? company?.sector) && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {company?.sector_en ?? company?.sector}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── 기업 스탯 ── */}
        {company && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Market Cap" value={fmtCap(company.market_cap)} />
            <StatCard
              label="Foreign Ratio"
              value={company.foreign_ratio != null ? `${company.foreign_ratio.toFixed(1)}%` : '—'}
            />
            <StatCard
              label="Listed Shares"
              value={company.listed_shares != null
                ? `${(company.listed_shares / 1_000_000).toFixed(1)}M`
                : '—'}
            />
            <StatCard
              label="Representative"
              value={company.representative ?? '—'}
            />
          </div>
        )}

        {/* ── 최근 공시 목록 ── */}
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">
            Recent Disclosures
          </p>

          {disclosures.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
              <p className="text-sm text-gray-500">No analyzed disclosures yet.</p>
              <p className="text-xs text-gray-600 mt-1">AI analysis runs automatically after each DART filing.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {disclosures.map((d) => (
                <Link
                  key={d.id}
                  href={`/signal/${d.id}`}
                  className="block rounded-xl border border-gray-800 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-800/40 transition p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 배지 행 */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <EventBadge eventType={d.event_type} />
                        <span className="text-xs text-gray-600">{formatDate(d.rcept_dt)}</span>
                        {d.signal_tag && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[#00D4A6]/10 text-[#00D4A6] border border-[#00D4A6]/20 font-medium">
                            {d.signal_tag}
                          </span>
                        )}
                      </div>
                      {/* 헤드라인 / 공시명 */}
                      <p className="text-sm font-medium text-gray-200 leading-snug line-clamp-2">
                        {d.headline ?? d.report_nm}
                      </p>
                      {/* Financial impact (한 줄 미리보기) */}
                      {d.financial_impact && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.financial_impact}</p>
                      )}
                    </div>
                    {/* 우측: sentiment + score */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <SentimentBadge score={d.sentiment_score} />
                      {d.base_score !== null && (
                        <span className="text-xs text-gray-600 tabular-nums">
                          Score {Math.round(d.base_score)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── DART 원문 링크 ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-0.5">Official Filings</p>
            <p className="text-xs text-gray-600">View all raw DART filings for {corpName}</p>
          </div>
          <a
            href={`https://dart.fss.or.kr/dsab007/detailSearch.do?currentPage=1&maxResults=10&textCrpCik=&corporationType=A&jurir_type=A&startDate=&endDate=&publicType=&corporationCode=&textCrpNm=${encodeURIComponent(corpName)}&businessCode=&sortFields=&sortTypes=`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-700 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white transition shrink-0"
          >
            DART <ExternalLink size={12} />
          </a>
        </div>

        {/* ── 잠금 미리보기 ── */}
        <div className="relative rounded-xl border border-gray-800 bg-gray-900/50 p-5 overflow-hidden">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">
            Full AI Analysis Report
          </p>
          <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden>
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-5/6" />
            <div className="h-3 bg-gray-700 rounded w-4/6" />
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-3/4" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-950/60 backdrop-blur-[2px]">
            <Lock size={16} className="text-gray-400" />
            <p className="text-xs text-gray-400 font-medium">Developer &amp; Pro plans</p>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="rounded-2xl border border-[#00D4A6]/20 bg-[#00D4A6]/5 p-8 text-center space-y-4">
          <p className="text-lg font-bold">Access Full Korean Market Signal Analytics</p>
          <div className="text-sm text-gray-400 space-y-1">
            <p>✔ AI-parsed DART filing classification &amp; scoring</p>
            <p>✔ Real-time event impact indicators</p>
            <p>✔ Historical pattern data via REST API</p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            <Link
              href={`/login?redirectTo=${encodeURIComponent('/disclosures?stock=' + code)}`}
              className="px-6 py-2.5 rounded-full bg-[#00D4A6] text-black text-sm font-semibold hover:bg-[#00bfa0] transition"
            >
              Get API Key →
            </Link>
            <Link
              href="/api-docs"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full border border-gray-700 text-sm font-medium hover:border-gray-500 transition"
            >
              View Docs <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          This content is for informational purposes only and does not constitute investment advice.
          All data is sourced from public DART filings (dart.fss.or.kr).
        </p>
      </div>
    </main>
  );
}
