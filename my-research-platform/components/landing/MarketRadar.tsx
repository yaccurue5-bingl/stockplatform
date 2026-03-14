'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

const sectors = [
  { name: 'Semiconductors', change: '+2.4%', positive: true },
  { name: 'Shipbuilding',   change: '+1.8%', positive: true },
  { name: 'Biotech',        change: '-0.5%', positive: false },
  { name: 'Chemicals',      change: '+1.2%', positive: true },
];

const flowData = [
  { v: 10 }, { v: 25 }, { v: 18 }, { v: 40 }, { v: 32 },
  { v: 52 }, { v: 48 }, { v: 60 }, { v: 55 }, { v: 72 },
  { v: 68 }, { v: 80 },
];

export default function MarketRadar() {
  return (
    <div className="bg-[#121821] border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-white">Market Radar</span>
        <span className="text-xs text-gray-500">Today · Mar 10, 2026</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {sectors.map((s) => (
          <div
            key={s.name}
            className={`rounded-xl p-4 border ${
              s.positive
                ? 'bg-[#00D4A6]/5 border-[#00D4A6]/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}
          >
            <p className="text-xs text-gray-400 mb-1">{s.name}</p>
            <p className={`text-lg font-bold ${s.positive ? 'text-[#00D4A6]' : 'text-red-400'}`}>
              {s.change}
            </p>
          </div>
        ))}
      </div>

      <div>
        <span className="text-xs text-gray-400">Foreign Net Flow</span>
        <p className="text-xl font-bold text-[#00D4A6] mt-1 mb-3">+₩1.2T</p>
        <ResponsiveContainer width="100%" height={70}>
          <LineChart data={flowData}>
            <Line type="monotone" dataKey="v" stroke="#00D4A6" strokeWidth={2} dot={false} />
            <Tooltip
              contentStyle={{ background: '#121821', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
              itemStyle={{ color: '#00D4A6' }}
              formatter={(v) => [`₩${(Number(v ?? 0) / 10).toFixed(1)}T`, 'Flow']}
              labelFormatter={() => ''}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
