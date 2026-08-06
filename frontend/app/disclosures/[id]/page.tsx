/**
 * /disclosures/[id]  — 공개 공시 상세 페이지 (Method B: 미끼 상품)
 *
 * - 로그인 불필요 (proxy.ts publicPaths에 /disclosures/ 포함)
 * - 헤드라인 / 이벤트 타입 / 감성 / Impact Score 공개
 * - AI 전문 요약 / 핵심 수치 / 리스크는 블러 처리 → CTA
 * - Next.js revalidate 3600s (공시 데이터는 불변 — 1h 후 재검증)
 */

import { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import BackButton from '@/components/BackButton';
import FinancialRatios from '@/components/disclosures/FinancialRatios';
import SignalStrength from '@/components/disclosures/SignalStrength';
import ShortPressure from '@/components/disclosures/ShortPressure';
import DataSourceNote from '@/components/DataSourceNote';
import SectorContextCard from '@/components/SectorContextCard';
import { fetchSectorContext } from '@/lib/fetchSectorContext';
import { generateTicker } from '@/lib/generateTicker';
import { classifyBuybackSubtype } from '@/components/CapitalReturnCard'
import GatedContent from '@/components/disclosures/GatedContent';
import DisclosureSearchBar from '@/components/disclosures/DisclosureSearchBar';
import EventHistoricalReaction from '@/components/disclosures/EventHistoricalReaction';
import { getEventMethodology } from '@/lib/config/event-methodology';
import MethodologySection from '@/components/MethodologySection';

export const revalidate = 3600; // 1h — 불변 데이터

const SITE_URL = 'https://k-marketinsight.com';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS:         'Earnings Release',
  CONTRACT:         'Strategic Contract',
  DILUTION:         'Capital Increase',
  BUYBACK:          'Share Buyback',
  DISPOSAL:         'Treasury Share Disposal',
  DIVIDEND:         'Dividend',
  MNA:              'M&A / Merger',
  LEGAL:            'Legal / Regulatory',
  CAPEX:            'Capital Investment',
  EXECUTIVE_CHANGE: 'Executive Change',
  OTHER:            'Corporate Disclosure',
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
    .single();

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
  } | null;

  // analysis_status는 재처리 중 completed → skipped 등으로 바뀔 수 있어 필터에서 뺐다
  // (GSC 404 반복 원인 — 한 번 인덱싱된 URL이 재분류 후 사라짐). 실제 콘텐츠 유무로 판단.
  if (!data || (!data.headline && !data.ai_summary)) {
    return { title: 'Disclosure Not Found | K-MarketInsight' };
  }

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
  corp_name_en: string | null;
  stock_code: string | null;
  rcept_dt: string;
  report_nm: string;
  report_nm_en: string | null;
  headline: string | null;
  event_type: string | null;
  sentiment_score: number | null;
  ai_summary: string | null;
  key_numbers: unknown;
  financial_impact: string | null;
  analysis_status: string | null;
  is_visible: boolean | null;
  sector: string | null;
}

// ai_summary/key_numbers는 "not found" 판정과 buybackSubtype 분류(카드 종류 결정, 실제
// 수치 아님)에만 서버에서 쓰인다 — 실 수치·요약 본문은 GatedContent가 클라이언트에서
// /api/disclosures/[id]/full로 로그인 유저에게만 별도로 받아온다.
const fetchDisclosure = unstable_cache(async (id: string): Promise<DisclosureRow | null> => {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('disclosure_insights')
    .select(
      'id, corp_name, corp_name_en, stock_code, rcept_dt, report_nm, report_nm_en, ' +
      'headline, event_type, sentiment_score, sector, ' +
      'ai_summary, key_numbers, financial_impact, ' +
      'analysis_status, is_visible'
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;
  const disclosure = data as unknown as DisclosureRow;

  // analysis_status는 재처리 중 completed → skipped 등으로 바뀔 수 있어 필터에서 뺐다
  // (GSC 404 반복 원인 — 한 번 인덱싱된 URL이 재분류 후 사라짐). 실제 콘텐츠 유무로 판단 —
  // 애초에 분석된 적 없는 행(진짜 skipped/pending)은 여전히 not found 처리된다.
  if (!disclosure.headline && !disclosure.ai_summary) return null;
  return disclosure;
}, ['disclosure-by-id'], { revalidate: 3600 });

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

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function DisclosureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // 오픈 리다이렉트 방지 — 우리 사이트 내부 경로(/로 시작)만 허용
  const backFallback = from && from.startsWith('/') && !from.startsWith('//') ? from : '/disclosures';

  const disclosure = await fetchDisclosure(id);
  if (!disclosure) notFound();

  const sectorContext = disclosure.sector ? await fetchSectorContext(disclosure.sector) : null;

  const score = disclosure.sentiment_score ?? 0;
  const sentiment = score >= 0.3 ? 'POSITIVE' : score <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';

  const eventLabel = EVENT_LABELS[disclosure.event_type ?? ''] ?? EVENT_LABELS.OTHER;
  const dateStr = disclosure.rcept_dt
    ? `${disclosure.rcept_dt.slice(0, 4)}-${disclosure.rcept_dt.slice(4, 6)}-${disclosure.rcept_dt.slice(6, 8)}`
    : '';

  // key_numbers JSON 파싱 — array or object
  const keyNums = (() => {
    try {
      const raw = disclosure.key_numbers;
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        // Array format: ["• Label: Value", ...] — extract label/value by splitting on first ':'
        const obj: Record<string, string> = {};
        parsed.forEach((item: unknown, i: number) => {
          const str = String(item).replace(/^[•\-–]\s*/, '');
          const colonIdx = str.indexOf(':');
          if (colonIdx > 0) {
            const k = str.slice(0, colonIdx).trim();
            const v = str.slice(colonIdx + 1).trim();
            obj[k] = v;
          } else {
            obj[`Item ${i + 1}`] = str;
          }
        });
        return Object.keys(obj).length > 0 ? obj : null;
      }
      if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string>;
      return null;
    } catch { return null; }
  })();

  // importance 파생: sentiment_score 절댓값 기준
  const importance =
    Math.abs(score) >= 0.6 ? 'HIGH' :
    Math.abs(score) >= 0.3 ? 'MEDIUM' : 'LOW';

  // Capital Return — BUYBACK 이벤트 전용
  // 분류는 keyNums 전체 기반, 수치 표시는 로그인 여부에 따라 결정
  const eventKey = (disclosure.event_type ?? 'OTHER').toUpperCase();
  const keyNumLines = keyNums
    ? Object.entries(keyNums).map(([k, v]) => `• ${k}: ${v}`)
    : [];
  const buybackSubtype =
    eventKey === 'BUYBACK'
      ? classifyBuybackSubtype(disclosure.headline, keyNumLines)
      : null;
  const methodology = getEventMethodology(disclosure.event_type);

  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      {/* 상단 네비 */}
      <div className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <BackButton fallback={backFallback} />
          <div className="w-40 sm:w-64 md:w-80 shrink-0">
            <DisclosureSearchBar />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* ── 헤더 (풀 너비) ── */}
        <div className="space-y-4 mb-8">
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
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white tracking-tight">
                  {generateTicker(disclosure.corp_name_en ?? disclosure.corp_name)}
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

        {/* ── 2컬럼 그리드 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── 좌: 메인 컨텐츠 ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Financial Impact (항상 공개) */}
            {disclosure.financial_impact && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">
                  Financial Impact
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">{disclosure.financial_impact}</p>
              </div>
            )}

            {/* Financial Ratios YoY */}
            <FinancialRatios
              stockCode={disclosure.stock_code ?? ''}
              eventType={disclosure.event_type ?? null}
            />

            {/* Historical Market Reaction — event_stats 기반 aggregate 통계 */}
            <EventHistoricalReaction eventType={disclosure.event_type ?? null} />

            {methodology && <MethodologySection methodology={methodology} />}

            {/* Sector Context */}
            {sectorContext && <SectorContextCard data={sectorContext} />}

            {/* Capital Return + AI Summary/Key Numbers/Risk Factors — 로그인 전용.
                서버는 항상 비로그인(블러) 버전으로 캐싱되고, GatedContent가 클라이언트에서
                인증을 확인한 뒤 /api/disclosures/[id]/full로 실 콘텐츠를 받아온다. */}
            <GatedContent disclosureId={id} buybackSubtype={buybackSubtype} />

            {/* Data Source Attribution */}
            <DataSourceNote
              source="DART"
              reportName={disclosure.report_nm_en ?? disclosure.report_nm}
            />
          </div>

          {/* ── 우: 사이드바 ── */}
          <div className="space-y-5">
            {/* Signal Strength */}
            <SignalStrength
              sentimentScore={disclosure.sentiment_score ?? 0}
              importance={importance}
            />

            {/* Short Pressure */}
            {disclosure.stock_code && (
              <ShortPressure stockCode={disclosure.stock_code} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
