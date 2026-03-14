'use client';

import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import StatBadge from './ui/StatBadge';

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

export default function Hero() {
  return (
    <section className="bg-[#0B0F14] py-20 px-4 overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-12 items-center">

        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 bg-[#121821] border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
            LIVE DATA · Updated 14:32 KST
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Korean Market<br />
            <span className="text-[#00D4A6]">Intelligence API</span>
          </h1>

          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Structured corporate events, sector signals, and market flows from Korean listed companies.
          </p>

          <div className="flex flex-wrap gap-2 mb-10">
            <StatBadge value="2,400+" label="Companies" />
            <StatBadge value="4.2M" label="Disclosures" />
            <StatBadge value="18" label="Sectors" />
            <StatBadge value="Since 2010" label="" />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-6 py-3 rounded-lg transition text-sm"
            >
              Get API Key →
            </Link>
            <Link
              href="#api-docs"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-lg transition text-sm"
            >
              View Documentation
            </Link>
          </div>
        </div>

        {/* Right – Market Radar Widget */}
        <div className="bg-[#121821] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-white">Market Radar</span>
            <span className="text-xs text-gray-500">Today · Mar 10, 2026</span>
          </div>

          {/* Sector cards */}
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

          {/* Foreign net flow chart */}
          <div>
            <span className="text-xs text-gray-400">Foreign Net Flow</span>
            <p className="text-xl font-bold text-[#00D4A6] mt-1 mb-3">+₩1.2T</p>
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={flowData}>
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4A6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#00D4A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="#00D4A6"
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
                  itemStyle={{ color: '#00D4A6' }}
                  formatter={(v) => [`₩${(Number(v ?? 0) / 10).toFixed(1)}T`, 'Flow']}
                  labelFormatter={() => ''}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </section>
  );
}
