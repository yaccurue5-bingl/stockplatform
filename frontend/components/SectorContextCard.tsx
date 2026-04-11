'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface SectorContextData {
  sector: string;                 // "Semiconductor"
  // sector_signals (30일 공시 통계)
  disclosures_total: number;
  disclosures_positive: number;
  disclosures_negative: number;
  disclosures_neutral: number;
  disclosure_signal: 'Bullish' | 'Bearish' | 'Neutral';
  disclosure_confidence: number;  // 0~1
  // sector_macro (월간 수출)
  export_yoy: number | null;      // % YoY
  export_signal: string | null;   // "positive" | "negative" | "neutral"
  export_report_date: string | null;
}

interface Props {
  data: SectorContextData;
}

function SignalChip({ signal }: { signal: 'Bullish' | 'Bearish' | 'Neutral' | string }) {
  const s = signal.toLowerCase();
  const styles =
    s === 'bullish' || s === 'positive'
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25'
      : s === 'bearish' || s === 'negative'
      ? 'text-red-400 bg-red-400/10 border-red-400/25'
      : 'text-gray-400 bg-gray-400/10 border-gray-400/25';
  const Icon =
    s === 'bullish' || s === 'positive'
      ? TrendingUp
      : s === 'bearish' || s === 'negative'
      ? TrendingDown
      : Minus;
  const label =
    s === 'bullish' || s === 'positive'
      ? 'Positive'
      : s === 'bearish' || s === 'negative'
      ? 'Negative'
      : 'Neutral';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${styles}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

export default function SectorContextCard({ data }: Props) {
  const [open, setOpen] = useState(false);

  const positiveRate =
    data.disclosures_total > 0
      ? Math.round((data.disclosures_positive / data.disclosures_total) * 100)
      : null;

  const exportStr =
    data.export_yoy !== null
      ? `${data.export_yoy >= 0 ? '+' : ''}${data.export_yoy.toFixed(1)}% YoY`
      : null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* 헤더 — 항상 노출, 클릭으로 펼침 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
            Market Context
          </p>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-400 font-medium">{data.sector}</span>
          {/* 요약 배지 — 접혔을 때만 표시 */}
          {!open && (
            <div className="flex items-center gap-2">
              <SignalChip signal={data.disclosure_signal} />
              {exportStr && (
                <span className={`text-xs font-semibold tabular-nums ${
                  data.export_yoy! >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {exportStr}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <span className="text-xs">{open ? 'Hide' : 'Show'}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* 펼쳐진 내용 */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-800/60">
          <p className="text-xs text-gray-600 mt-3 mb-4 italic">
            Sector context only — not included in Signal Score calculation.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* 섹터 공시 동향 */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Sector Disclosures (30d)
              </p>
              <div className="flex items-center gap-2">
                <SignalChip signal={data.disclosure_signal} />
                {positiveRate !== null && (
                  <span className="text-xs text-gray-400">
                    {positiveRate}% positive
                  </span>
                )}
              </div>
              {data.disclosures_total > 0 && (
                <div className="space-y-1">
                  {/* 미니 바 차트 */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-gray-800 gap-px">
                    {data.disclosures_positive > 0 && (
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${(data.disclosures_positive / data.disclosures_total) * 100}%` }}
                      />
                    )}
                    {data.disclosures_neutral > 0 && (
                      <div
                        className="bg-gray-500"
                        style={{ width: `${(data.disclosures_neutral / data.disclosures_total) * 100}%` }}
                      />
                    )}
                    {data.disclosures_negative > 0 && (
                      <div
                        className="bg-red-500"
                        style={{ width: `${(data.disclosures_negative / data.disclosures_total) * 100}%` }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {data.disclosures_positive}↑ &nbsp;
                    {data.disclosures_neutral}— &nbsp;
                    {data.disclosures_negative}↓ &nbsp;
                    <span className="text-gray-700">/ {data.disclosures_total} filings</span>
                  </p>
                </div>
              )}
            </div>

            {/* 수출 동향 */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Export Trend
                {data.export_report_date && (
                  <span className="text-gray-700 font-normal ml-1.5">
                    ({data.export_report_date})
                  </span>
                )}
              </p>
              {exportStr ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold tabular-nums ${
                      data.export_yoy! >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {exportStr}
                    </span>
                    {data.export_signal && <SignalChip signal={data.export_signal} />}
                  </div>
                  <p className="text-xs text-gray-600">
                    Ministry of Trade, Industry &amp; Energy (MOTIE)
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-600">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
