import Link from 'next/link';
import Section from './ui/Section';
import Card from './ui/Card';
import { Zap } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS: 'Earnings Release',
  CONTRACT: 'Strategic Contract',
  DILUTION: 'Capital Increase',
  BUYBACK:  'Share Buyback',
  MNA:      'M&A / Merger',
  LEGAL:    'Legal / Regulatory',
  CAPEX:    'Capital Investment',
  OTHER:    'Disclosure',
};

const SENTIMENT_STYLE: Record<string, string> = {
  POSITIVE: 'bg-[#00D4A6]/10 text-[#00D4A6] border-[#00D4A6]/30',
  NEGATIVE: 'bg-red-400/10 text-red-400 border-red-400/30',
  NEUTRAL:  'bg-gray-400/10 text-gray-400 border-gray-400/30',
};

// DB에 데이터가 없을 때 표시할 폴백 (초기 셋업 기간 대비)
const FALLBACK_EVENTS = [
  { id: '', company: 'Samsung Electronics', company_kr: '삼성전자', ticker: '005930', event: 'Earnings Beat',      impact: '+0.83', positive: true,  color: SENTIMENT_STYLE.POSITIVE },
  { id: '', company: 'SK Hynix',            company_kr: 'SK하이닉스', ticker: '000660', event: 'Capital Investment',  impact: '+0.71', positive: true,  color: SENTIMENT_STYLE.POSITIVE },
  { id: '', company: 'Hyundai Motor',        company_kr: '현대자동차', ticker: '005380', event: 'Strategic Contract', impact: '+0.65', positive: true,  color: SENTIMENT_STYLE.NEUTRAL  },
];

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchLatestEvents() {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('disclosure_insights')
      .select('id, corp_name, stock_code, event_type, sentiment_score')
      .eq('analysis_status', 'completed')
      .eq('is_visible', true)
      .order('rcept_dt', { ascending: false })
      .limit(5);

    if (error || !data?.length) return null;

    // 영문 기업명 조회
    const stockCodes = [...new Set(data.map((r) => r.stock_code).filter(Boolean))];
    const corpNameEnMap: Record<string, string> = {};
    if (stockCodes.length > 0) {
      const { data: corpData } = await sb
        .from('dart_corp_codes')
        .select('stock_code, corp_name_en')
        .in('stock_code', stockCodes);
      if (corpData) {
        corpData.forEach((c: any) => { if (c.corp_name_en) corpNameEnMap[c.stock_code] = c.corp_name_en; });
      }
    }

    return data.map((row) => {
      const score  = row.sentiment_score ?? 0;
      const sentiment = score >= 0.3 ? 'POSITIVE' : score <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';
      const corpNameEn = corpNameEnMap[row.stock_code] ?? null;
      return {
        id:          row.id ?? '',
        company:     corpNameEn ?? row.corp_name ?? '',
        company_kr:  corpNameEn ? (row.corp_name ?? '') : '',
        ticker:      row.stock_code ?? '',
        event:       EVENT_LABELS[row.event_type ?? ''] ?? EVENT_LABELS.OTHER,
        impact:      (score >= 0 ? '+' : '') + score.toFixed(2),
        positive:    score >= 0,
        color:       SENTIMENT_STYLE[sentiment] ?? SENTIMENT_STYLE.NEUTRAL,
      };
    });
  } catch {
    return null;
  }
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default async function LiveEvents() {
  const events = (await fetchLatestEvents()) ?? FALLBACK_EVENTS;

  return (
    <Section className="bg-[#0D1117]" id="events">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-[#00D4A6]" />
        <span className="text-xs text-[#00D4A6] font-semibold uppercase tracking-widest">Real-time</span>
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Live Corporate Events</h2>
      <p className="text-gray-400 mb-10">AI-classified signals from DART disclosures, updated in real-time.</p>

      <div className="flex flex-col gap-3">
        {events.map((e) => (
          <Link
            key={e.id || `${e.company}-${e.ticker}`}
            href={e.id ? `/disclosures/${e.id}` : '/disclosures'}
            className="block"
          >
          <Card hover className="flex items-center justify-between px-6 py-5 cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-300">
                  {e.company.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{e.company}</p>
                <p className="text-xs text-gray-500">{e.company_kr || e.ticker}</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${e.color}`}>{e.event}</span>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${e.positive ? 'text-[#00D4A6]' : 'text-red-400'}`}>{e.impact}</p>
              <p className="text-xs text-gray-500">Impact Score</p>
            </div>
          </Card>
          </Link>
        ))}
      </div>
    </Section>
  );
}
