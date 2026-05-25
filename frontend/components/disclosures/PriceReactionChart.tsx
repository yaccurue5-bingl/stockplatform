'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, TooltipProps,
} from 'recharts';

interface PricePoint {
  date: string;
  close: number;
  open: number;
  volume: number;
  volume_z: number | null;
}

interface ChartPoint {
  label: string;       // MM/DD
  pct: number;         // % change from disclosure date
  close: number;
  isDisclosure: boolean;
}

interface Props {
  stockCode: string;
  disclosureDate: string; // ISO string
}

export default function PriceReactionChart({ stockCode, disclosureDate }: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseDate, setBaseDate] = useState('');

  useEffect(() => {
    if (!stockCode || !disclosureDate) return;
    const dateStr = disclosureDate.split('T')[0];
    setBaseDate(dateStr);
    setLoading(true);

    fetch(`/api/price-chart?stock=${stockCode}&date=${dateStr}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: PricePoint[]) => {
        if (!rows.length) { setLoading(false); return; }

        // 공시일 기준 가격 찾기 (없으면 가장 가까운 날)
        const discRow = rows.find(r => r.date === dateStr) ?? rows[Math.floor(rows.length / 2)];
        const basePrice = discRow.close;

        const points: ChartPoint[] = rows.map(r => ({
          label: r.date.slice(5),  // MM-DD
          pct: parseFloat(((r.close - basePrice) / basePrice * 100).toFixed(2)),
          close: r.close,
          isDisclosure: r.date === dateStr,
        }));

        setData(points);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stockCode, disclosureDate]);

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as ChartPoint;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
        <p className="text-gray-400">{label}</p>
        <p className={`font-bold ${p.pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {p.pct >= 0 ? '+' : ''}{p.pct}%
        </p>
        <p className="text-gray-500">₩{p.close.toLocaleString()}</p>
      </div>
    );
  };

  const disclosureLabel = baseDate.slice(5); // MM-DD
  const lastPct = data.at(-1)?.pct ?? 0;
  const lineColor = lastPct >= 0 ? '#4ade80' : '#f87171';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold">Price Reaction</h3>
        {data.length > 0 && (
          <span className={`text-sm font-bold ${lastPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {lastPct >= 0 ? '+' : ''}{lastPct}% post-disclosure
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-36 flex items-center justify-center text-xs text-gray-600 animate-pulse">
          Loading chart…
        </div>
      ) : data.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-xs text-gray-600">
          No price data available
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={disclosureLabel}
                stroke="#60a5fa"
                strokeDasharray="4 2"
                label={{ value: 'D', position: 'top', fontSize: 10, fill: '#60a5fa' }}
              />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 2" />
              <Line
                type="monotone"
                dataKey="pct"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: lineColor }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-600 mt-1 text-right">
            D = disclosure date · % change vs. disclosure close
          </p>
        </>
      )}
    </div>
  );
}
