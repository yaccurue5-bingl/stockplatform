/**
 * /signal/[id]  — SEO 공시 시그널 페이지
 *
 * - 로그인 불필요, 구글 인덱싱 대상
 * - 공개: headline, event_type, date, company, sentiment, financial_impact, key_numbers 일부, ai_summary
 * - Public Beta: 모든 콘텐츠 공개 (플랜 잠금 없음)
 * - generateMetadata: 신호별 동적 title/description
 * - JSON-LD: NewsArticle 스키마 (per-signal)
 */

import { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { TrendingUp, TrendingDown, Minus, ArrowLeft } from 'lucide-react';
import DataSourceNote from '@/components/DataSourceNote';
import SectorContextCard from '@/components/SectorContextCard';
import { fetchSectorContext } from '@/lib/fetchSectorContext';
import { generateTicker } from '@/lib/generateTicker';
import CapitalReturnCard, { classifyBuybackSubtype } from '@/components/CapitalReturnCard';
import SignalTopActions from '@/components/SignalTopActions';
import SignalBottomCTA from '@/components/SignalBottomCTA';
import MethodologySection from '@/components/MethodologySection';
import { getEventMethodology } from '@/lib/config/event-methodology';

export const revalidate = 3600;

const SITE_URL = 'https://k-marketinsight.com';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS:         'Earnings Release',
  CONTRACT:         'Strategic Contract',
  DILUTION:         'Capital Increase / Dilution',
  BUYBACK:          'Share Buyback',
  DIVIDEND:         'Dividend',
  MNA:              'M&A / Merger',
  LEGAL:            'Legal / Regulatory',
  CAPEX:            'Capital Investment',
  EXECUTIVE_CHANGE: 'Executive Change',
  OTHER:            'Corporate Disclosure',
};

const EVENT_COLORS: Record<string, string> = {
  EARNINGS:         'text-blue-400 bg-blue-400/10 border-blue-400/20',
  CONTRACT:         'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  DILUTION:         'text-orange-400 bg-orange-400/10 border-orange-400/20',
  BUYBACK:          'text-purple-400 bg-purple-400/10 border-purple-400/20',
  DIVIDEND:         'text-teal-400 bg-teal-400/10 border-teal-400/20',
  MNA:              'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  LEGAL:            'text-red-400 bg-red-400/10 border-red-400/20',
  CAPEX:            'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  EXECUTIVE_CHANGE: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  OTHER:            'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface SignalRow {
  id: string;
  corp_name: string | null;
  corp_name_en: string | null;
  stock_code: string | null;
  rcept_dt: string;
  report_nm: string;
  headline: string | null;
  event_type: string | null;
  sentiment_score: number | null;
  ai_summary: string | null;
  key_numbers: unknown;
  risk_factors: string | null;
  financial_impact: string | null;
  sector: string | null;
}

interface EventScore {
  event: string;
  score: number | null;
  grade: string | null;
  data_coverage: number | null;
  historical_avg_return_5d: number | null;
  sample_size: number | null;
  risk_adj_factor: number | null;
}

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

const fetchEventScore = unstable_cache(async (eventType: string): Promise<EventScore | null> => {
  try {
    const sb = createServiceClient();
    const { data: raw, error } = await sb
      .from('event_stats')
      .select(
        'event_type, signal_score, signal_grade, signal_confidence, ' +
        'median_5d_return, sample_size_clean, risk_adj_return'
      )
      .eq('event_type', eventType.toUpperCase())
      .single();

    if (error || !raw) return null;
    const data = raw as unknown as {
      event_type: string;
      signal_score: number | null;
      signal_grade: string | null;
      signal_confidence: number | null;
      median_5d_return: number | null;
      sample_size_clean: number | null;
      risk_adj_return: number | null;
    };
    return {
      event:                    data.event_type,
      score:                    data.signal_score,
      grade:                    data.signal_grade,
      data_coverage:            data.signal_confidence,
      historical_avg_return_5d: data.median_5d_return,
      sample_size:              data.sample_size_clean,
      risk_adj_factor:          data.risk_adj_return,
    };
  } catch {
    return null;
  }
}, ['signal-event-score'], { revalidate: 3600 });

const fetchSignal = unstable_cache(async (id: string): Promise<SignalRow | null> => {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('disclosure_insights')
    .select(
      'id, corp_name, corp_name_en, stock_code, rcept_dt, report_nm, ' +
      'headline, event_type, sentiment_score, sector, ' +
      'ai_summary, key_numbers, risk_factors, financial_impact'
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;
  const signal = data as unknown as SignalRow;

  // analysis_status는 재처리 과정에서 completed → skipped 등으로 바뀔 수 있어
  // (GSC 404 반복 원인 — 한 번 인덱싱된 URL이 재분류 후 사라짐) 필터에서 뺐다.
  // 대신 실제 콘텐츠(headline/ai_summary) 유무로만 판단 — 애초에 분석된 적 없는
  // 행(진짜 skipped/pending)은 여전히 not found 처리된다.
  if (!signal.headline && !signal.ai_summary) return null;
  return signal;
}, ['signal-by-id'], { revalidate: 3600 });

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function parseKeyNumbers(raw: unknown): string[] {
  try {
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // 배열 형식: ["• Figure 1", ...]
    if (Array.isArray(parsed)) return parsed.map(String);
    // 객체 형식: {"Revenue": "100B KRW", ...}
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed as Record<string, string>).map(
        ([k, v]) => `• ${k}: ${v}`
      );
    }
  } catch { /* ignore */ }
  return [];
}

function formatDate(rcept_dt: string): string {
  if (!rcept_dt || rcept_dt.length < 8) return rcept_dt;
  return `${rcept_dt.slice(0, 4)}-${rcept_dt.slice(4, 6)}-${rcept_dt.slice(6, 8)}`;
}

function deriveSentiment(score: number | null): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  if (score === null) return 'NEUTRAL';
  return score >= 0.3 ? 'POSITIVE' : score <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const signal = await fetchSignal(id);

  if (!signal) {
    return { title: 'Signal Not Found | K-MarketInsight' };
  }

  const rawTitle = signal.headline ?? signal.report_nm ?? 'Corporate Disclosure';
  // 타이틀 태그 최대 59자 — 동적 계산으로 corp_name 길이에 따라 헤드라인 자르기
  const SUFFIX = ' | K-MarketInsight';           // 18자
  const MID = ` — ${signal.corp_name ?? ''}`;    // 4 + corp_name 길이
  const available = 59 - SUFFIX.length - MID.length;
  const titleBase = rawTitle.length > available
    ? rawTitle.slice(0, Math.max(available - 1, 10)) + '…'
    : rawTitle;
  const title = `${titleBase}${MID}${SUFFIX}`;

  const description = signal.financial_impact
    ? signal.financial_impact.slice(0, 160)
    : signal.ai_summary
    ? signal.ai_summary.slice(0, 160)
    : `${EVENT_LABELS[signal.event_type ?? ''] ?? 'Corporate Disclosure'} from ${signal.corp_name} (${signal.stock_code}). DART filing analysis by K-MarketInsight.`;

  const canonicalUrl = `${SITE_URL}/signal/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'K-MarketInsight',
      locale: 'en_US',
      type: 'article',
      publishedTime: signal.rcept_dt
        ? `${signal.rcept_dt.slice(0, 4)}-${signal.rcept_dt.slice(4, 6)}-${signal.rcept_dt.slice(6, 8)}`
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function SentimentBadge({ score }: { score: number | null }) {
  const sentiment = deriveSentiment(score);
  const styles = {
    POSITIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    NEGATIVE: 'bg-red-500/10 text-red-400 border-red-500/30',
    NEUTRAL:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  const Icon = sentiment === 'POSITIVE' ? TrendingUp : sentiment === 'NEGATIVE' ? TrendingDown : Minus;
  const label = score !== null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—';

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${styles[sentiment]}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

function EventBadge({ eventType }: { eventType: string | null }) {
  const key = (eventType ?? 'OTHER').toUpperCase();
  const label = EVENT_LABELS[key] ?? EVENT_LABELS.OTHER;
  const color = EVENT_COLORS[key] ?? EVENT_COLORS.OTHER;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-semibold uppercase tracking-wider ${color}`}>
      {label}
    </span>
  );
}

const GRADE_STYLES: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  A: { ring: 'border-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'High Positive Signal' },
  B: { ring: 'border-[#00D4A6]',   text: 'text-[#00D4A6]',   bg: 'bg-[#00D4A6]/10',   label: 'Moderate Signal' },
  C: { ring: 'border-yellow-400',  text: 'text-yellow-400',  bg: 'bg-yellow-400/10',  label: 'Neutral' },
  D: { ring: 'border-orange-400',  text: 'text-orange-400',  bg: 'bg-orange-400/10',  label: 'Weak Signal' },
  F: { ring: 'border-red-400',     text: 'text-red-400',     bg: 'bg-red-400/10',     label: 'Low Signal' },
};

function SignalScoreCard({ score }: { score: EventScore }) {
  const grade   = score.grade ?? 'C';
  const style   = GRADE_STYLES[grade] ?? GRADE_STYLES['C'];
  const pct     = score.score ?? 0;
  const retStr  = score.historical_avg_return_5d !== null
    ? `${score.historical_avg_return_5d >= 0 ? '+' : ''}${score.historical_avg_return_5d.toFixed(2)}%`
    : '—';
  const confPct = score.data_coverage !== null ? Math.round(score.data_coverage * 100) : null;

  return (
    <div className={`rounded-xl border ${style.ring} ${style.bg} p-5`}>
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-4">
        Signal Score
      </p>

      <div className="flex items-center gap-6">
        {/* 큰 숫자 + 등급 */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className={`text-5xl font-black tabular-nums ${style.text}`}>{pct}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${style.ring} ${style.text}`}>
            {grade} — {style.label}
          </span>
        </div>

        {/* 세부 지표 */}
        <div className="flex-1 space-y-2.5">
          {/* 게이지 */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Score</span>
              <span>{pct} / 100</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${style.text.replace('text-', 'bg-')}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Historical Avg Return + Data Coverage */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">Historical Avg Return (5d)</p>
              <p className={`font-semibold tabular-nums ${style.text}`}>{retStr}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Data Coverage</p>
              <p className="font-semibold text-white">
                {confPct !== null ? `${confPct}%` : '—'}
                {score.sample_size !== null && (
                  <span className="text-xs text-gray-500 ml-1">n={score.sample_size}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Risk-adjusted indicator based on {score.sample_size ?? '—'} historical DART filings.
        For informational purposes only — not investment advice.
      </p>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function SignalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const signal = await fetchSignal(id);
  if (!signal) notFound();

  const dateStr    = formatDate(signal.rcept_dt);
  const eventKey   = (signal.event_type ?? 'OTHER').toUpperCase();
  const keyNums    = parseKeyNumbers(signal.key_numbers);

  // Capital Return 분류 (BUYBACK 이벤트 전용)
  const buybackSubtype =
    eventKey === 'BUYBACK'
      ? classifyBuybackSubtype(signal.headline, keyNums)
      : null;

  // Signal Score (event_stats 조회)
  const eventScore = signal.event_type ? await fetchEventScore(signal.event_type) : null;

  // Methodology (이벤트 타입별 스코어링 근거)
  const methodology = getEventMethodology(signal.event_type);

  // Sector Context
  const sectorContext = signal.sector ? await fetchSectorContext(signal.sector) : null;

  // per-signal JSON-LD  (Google NewsArticle 필수 필드 충족)
  const pubDate = signal.rcept_dt
    ? `${signal.rcept_dt.slice(0, 4)}-${signal.rcept_dt.slice(4, 6)}-${signal.rcept_dt.slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/signal/${id}` },
    headline: (signal.headline ?? signal.report_nm ?? 'Corporate Disclosure').slice(0, 110),
    description: (
      signal.financial_impact ??
      signal.ai_summary ??
      `${EVENT_LABELS[signal.event_type ?? ''] ?? 'Corporate Disclosure'} from ${signal.corp_name ?? 'Korean company'}.`
    ).slice(0, 200),
    image: `${SITE_URL}/logo.jpg`,   // 필수 — 없으면 rich result 불가
    datePublished: pubDate,
    dateModified:  pubDate,
    author: { '@type': 'Organization', name: 'K-MarketInsight', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name:    'K-MarketInsight',
      url:     SITE_URL,
      logo:    { '@type': 'ImageObject', url: `${SITE_URL}/logo.jpg` },
    },
    url: `${SITE_URL}/signal/${id}`,
    ...(signal.corp_name ? {
      about: {
        '@type': 'Corporation',
        name: signal.corp_name,
        ...(signal.stock_code ? { tickerSymbol: signal.stock_code } : {}),
      },
    } : {}),
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
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft size={15} />
            K-MarketInsight
          </Link>
          <SignalTopActions disclosureId={id} stockCode={signal.stock_code} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* ── 헤더 ── */}
        <div className="space-y-4">
          {/* 이벤트 타입 + 날짜 */}
          <div className="flex items-center gap-3 flex-wrap">
            <EventBadge eventType={signal.event_type} />
            <span className="text-xs text-gray-500">{dateStr}</span>
          </div>

          {/* 헤드라인 */}
          <h1 className="text-2xl font-bold leading-snug">
            {signal.headline ?? signal.report_nm ?? 'Corporate Disclosure'}
          </h1>

          {/* 기업 + 감성 */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-gray-300">
                  {generateTicker(signal.corp_name_en ?? signal.corp_name)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold">{signal.corp_name}</p>
                {signal.stock_code && (
                  <p className="text-xs text-gray-500">{signal.stock_code}</p>
                )}
              </div>
            </div>
            <SentimentBadge score={signal.sentiment_score} />
          </div>
        </div>

        {/* ── Signal Score ── */}
        {eventScore?.score !== null && eventScore !== null && (
          <SignalScoreCard score={eventScore} />
        )}

        {/* ── Sector Context ── */}
        {sectorContext && <SectorContextCard data={sectorContext} />}

        {/* ── Financial Impact (공개) ── */}
        {signal.financial_impact && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">
              Financial Impact
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">{signal.financial_impact}</p>
          </div>
        )}

        {/* ── Capital Return (BUYBACK 이벤트 전용) ── */}
        {buybackSubtype && (
          <CapitalReturnCard
            subtype={buybackSubtype}
            publicKeyNums={keyNums}
          />
        )}

        {/* ── Key Numbers (전체 공개) ── */}
        {keyNums.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">
              Key Numbers
            </p>
            <ul className="space-y-2">
              {keyNums.map((item, i) => (
                <li key={i} className="text-sm text-gray-300 font-mono">{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── AI Summary (공개) ── */}
        {signal.ai_summary && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">
              AI Analysis Summary
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">{signal.ai_summary}</p>
          </div>
        )}

        {/* ── Methodology (스코어는 로직 기반, AI는 요약만) ── */}
        {methodology && <MethodologySection methodology={methodology} />}

        {/* ── CTA (비로그인 유저만 — 클라이언트에서 판단) ── */}
        <SignalBottomCTA stockCode={signal.stock_code} />

        {/* ── Disclaimer ── */}
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          This content is for informational purposes only and does not constitute investment advice.
          Past signal patterns do not guarantee future results. All data is sourced from public DART filings.
        </p>

        {/* ── Data Source Attribution ── */}
        <DataSourceNote
          source="DART"
          reportName={signal.report_nm}
        />

        {/* ── 관련 링크 (SEO internal linking) ── */}
        <div className="pt-2 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
          <Link href={`/korea-${(eventKey === 'EARNINGS' ? 'earnings' : eventKey === 'DILUTION' ? 'dilution' : eventKey === 'CONTRACT' ? 'contract' : 'earnings')}-signals`}
            className="hover:text-gray-300 transition">
            More {EVENT_LABELS[eventKey] ?? 'Signals'} →
          </Link>
          <Link href="/datasets" className="hover:text-gray-300 transition">
            All Datasets →
          </Link>
          <Link href="/api-access" className="hover:text-gray-300 transition">
            API Access →
          </Link>
        </div>
      </div>
    </main>
  );
}
