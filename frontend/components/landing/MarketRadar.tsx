'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

// ---- Types ----
interface FlowPoint {
  date: string;
  value: number;
}

interface TopSector {
  sector_en: string;
  signal: string;
  avg_return_3d: number;
  disclosure_count: number;
  score: number;
}

interface RadarData {
  date: string | null;
  regime: 'RISK_ON' | 'RISK_OFF';
  kospi: { value: number; change: number } | null;
  kosdaq: { value: number; change: number } | null;
  foreign_net_buy: number;
  flow_trend: FlowPoint[];
  top_sectors: TopSector[];
}

// ---- Fallback (하드코딩) ----
const FALLBACK: RadarData = {
  date: 'Mar 10, 2026',
  regime: 'RISK_ON',
  kospi: { value: 2748, change: 1.2 },
  kosdaq: { value: 891, change: 0.8 },
  foreign_net_buy: 5438,
  flow_trend: [
    { date: '', value: 10 }, { date: '', value: 25 }, { date: '', value: 18 },
    { date: '', value: 40 }, { date: '', value: 32 }, { date: '', value: 52 },
    { date: '', value: 48 }, { date: '', value: 60 }, { date: '', value: 55 },
    { date: '', value: 72 }, { date: '', value: 68 }, { date: '', value: 80 },
  ],
  top_sectors: [],
};

// ---- Helpers ----
function formatDate(raw: string | null): string {
  if (!raw) return '—';
  // raw: "YYYY-MM-DD" or "YYYYMMDD"
  const s = raw.replace(/-/g, '');
  if (s.length === 8) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  }
  return raw;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

function formatForeign(val: number): string {
  const sign = val >= 0 ? '+' : '';
  const abs = Math.abs(val);
  if (abs >= 10000) {
    return `${sign}₩${(abs / 10000).toFixed(1)}조`;
  }
  return `${sign}₩${Math.round(abs).toLocaleString()}억`;
}

// ---- Skeleton ----
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-700/50 ${className ?? ''}`} />;
}

// ---- Main Component ----
export default function MarketRadar() {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/market-radar-widget');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: RadarData = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        console.warn('[MarketRadar] fetch failed, using fallback', e);
        if (!cancelled) setData(FALLBACK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 로딩 스켈레톤
  if (loading) {
    return (
      <div className="bg-[#121821] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-3 w-28 mb-2" />
        <Skeleton className="h-6 w-32 mb-3" />
        <Skeleton className="h-[70px] w-full" />
      </div>
    );
  }

  const d = data ?? FALLBACK;

  // flow_trend min/max 보정
  const flowValues = d.flow_trend.map((p) => p.value);
  const minVal = flowValues.length > 0 ? Math.min(...flowValues) : 0;
  const maxVal = flowValues.length > 0 ? Math.max(...flowValues) : 100;
  const padding = (maxVal - minVal) * 0.1 || 10;
  const yDomain: [number, number] = [minVal - padding, maxVal + padding];

  const isPositiveForeign = d.foreign_net_buy >= 0;
  const regimePositive = d.regime === 'RISK_ON';

  // 4개 박스
  const boxes = [
    {
      label: 'KOSPI',
      value: d.kospi ? d.kospi.value.toLocaleString() : '—',
      sub: d.kospi ? formatChange(d.kospi.change) : null,
      positive: d.kospi ? d.kospi.change >= 0 : true,
    },
    {
      label: 'KOSDAQ',
      value: d.kosdaq ? d.kosdaq.value.toLocaleString() : '—',
      sub: d.kosdaq ? formatChange(d.kosdaq.change) : null,
      positive: d.kosdaq ? d.kosdaq.change >= 0 : true,
    },
    {
      label: 'Regime',
      value: d.regime,
      sub: null,
      positive: regimePositive,
    },
    {
      label: 'Foreign Today',
      value: formatForeign(d.foreign_net_buy),
      sub: null,
      positive: isPositiveForeign,
    },
  ];

  return (
    <div className="bg-[#121821] border border-gray-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-white">Market Radar</span>
        <span className="text-xs text-gray-500">Today · {formatDate(d.date)}</span>
      </div>

      {/* 4 Boxes */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {boxes.map((box) => (
          <div
            key={box.label}
            className={`rounded-xl p-4 border ${
              box.positive
                ? 'bg-[#00D4A6]/5 border-[#00D4A6]/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}
          >
            <p className="text-xs text-gray-400 mb-1">{box.label}</p>
            <p className={`text-lg font-bold leading-tight ${box.positive ? 'text-[#00D4A6]' : 'text-red-400'}`}>
              {box.value}
            </p>
            {box.sub && (
              <p className={`text-xs mt-0.5 ${box.positive ? 'text-[#00D4A6]/70' : 'text-red-400/70'}`}>
                {box.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Foreign Net Flow Chart */}
      <div>
        <span className="text-xs text-gray-400">Foreign Net Flow</span>
        <p className={`text-xl font-bold mt-1 mb-3 ${isPositiveForeign ? 'text-[#00D4A6]' : 'text-red-400'}`}>
          {formatForeign(d.foreign_net_buy)}
        </p>
        <ResponsiveContainer width="100%" height={70}>
          <LineChart data={d.flow_trend.map((p) => ({ v: p.value, date: p.date }))}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={isPositiveForeign ? '#00D4A6' : '#f87171'}
              strokeWidth={2}
              dot={false}
            />
            <Tooltip
              contentStyle={{
                background: '#121821',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              itemStyle={{ color: isPositiveForeign ? '#00D4A6' : '#f87171' }}
              formatter={(v: number) => [formatForeign(v), 'Flow']}
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date;
                return date ? formatDate(date) : '';
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Sectors (데이터 있을 때만) */}
      {d.top_sectors.length > 0 && (
        <div className="mt-5 border-t border-gray-800 pt-4">
          <span className="text-xs text-gray-400 mb-3 block">Top Sectors</span>
          <div className="flex flex-col gap-2">
            {d.top_sectors.map((sec) => {
              const pos = sec.avg_return_3d >= 0;
              return (
                <div key={sec.sector_en} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white font-medium">{sec.sector_en}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        sec.signal === 'HIGH_CONVICTION'
                          ? 'bg-[#00D4A6]/15 text-[#00D4A6]'
                          : sec.signal === 'CONSTRUCTIVE'
                          ? 'bg-blue-500/15 text-blue-400'
                          : sec.signal === 'NEGATIVE'
                          ? 'bg-orange-500/15 text-orange-400'
                          : sec.signal === 'HIGH_RISK'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {sec.signal === 'HIGH_CONVICTION' ? 'High Conviction'
                        : sec.signal === 'CONSTRUCTIVE' ? 'Constructive'
                        : sec.signal === 'NEGATIVE' ? 'Negative Bias'
                        : sec.signal === 'HIGH_RISK' ? 'High Risk'
                        : 'Neutral'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold ${pos ? 'text-[#00D4A6]' : 'text-red-400'}`}>
                      {pos ? '+' : ''}{sec.avg_return_3d.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-gray-500 ml-1.5">{sec.disclosure_count}건</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
