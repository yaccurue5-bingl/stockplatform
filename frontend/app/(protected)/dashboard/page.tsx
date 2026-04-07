'use client';

import AppShell from '@/components/app/AppShell';
import MarketRadar from '@/components/landing/MarketRadar';
import { Zap, TrendingUp, FileText, Bell } from 'lucide-react';

const stats = [
  { label: 'API Calls Today',  value: '1,284',  sub: '+12% vs yesterday',           color: '#00D4A6' },
  { label: 'Monthly Usage',    value: '38,402', sub: '76% of 50,000 limit',         color: '#4EA3FF' },
  { label: 'Active Endpoints', value: '4',      sub: 'events, signals, radar, co.', color: '#a78bfa' },
  { label: 'Avg Latency',      value: '142ms',  sub: 'p95: 310ms',                  color: '#fb923c' },
];

const recentActivity = [
  { endpoint: 'GET /v1/events',         status: 200, ts: '14:31:02', ms: 138 },
  { endpoint: 'GET /v1/sector-signals', status: 200, ts: '14:30:47', ms: 95  },
  { endpoint: 'GET /v1/market-radar',   status: 200, ts: '14:29:12', ms: 201 },
  { endpoint: 'GET /v1/company/005930', status: 200, ts: '14:28:55', ms: 119 },
  { endpoint: 'GET /v1/events',         status: 429, ts: '14:27:30', ms: 12  },
  { endpoint: 'GET /v1/sector-signals', status: 200, ts: '14:26:18', ms: 87  },
];

export default function DashboardPage() {
  const usedPct = 76;

  return (
    <AppShell title="Dashboard" subtitle="Welcome back, smile">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-2">{s.label}</p>
            <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-gray-500">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Market Radar */}
        <div className="lg:col-span-1">
          <MarketRadar />
        </div>

        {/* Quota + Quick Actions */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Quota bar */}
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Monthly Quota</p>
              <span className="text-xs text-gray-500">Developer Plan · resets Apr 1</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-[#00D4A6]" style={{ width: `${usedPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>38,402 used</span>
              <span>50,000 limit</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-4">Quick Actions</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Bell,       label: 'Disclosures', href: '/disclosures', color: '#f59e0b' },
                { icon: Zap,        label: 'Try API',     href: '/api-docs',    color: '#00D4A6' },
                { icon: TrendingUp, label: 'View Usage',  href: '/usage',       color: '#4EA3FF' },
                { icon: FileText,   label: 'Browse Data', href: '/datasets',    color: '#a78bfa' },
              ].map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-800 hover:border-gray-600 bg-gray-900/30 hover:bg-gray-800/50 transition text-center"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${a.color}18` }}>
                    <a.icon size={16} style={{ color: a.color }} />
                  </div>
                  <span className="text-xs text-gray-300 font-medium">{a.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent API Activity */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-500" />
            <p className="text-sm font-semibold text-white">Recent API Activity</p>
          </div>
          <a href="/usage" className="text-xs text-[#00D4A6] hover:underline">View all →</a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800/60">
              <th className="text-left px-5 py-3 font-medium">Endpoint</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Time</th>
              <th className="text-right px-5 py-3 font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((row, i) => (
              <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition">
                <td className="px-5 py-3 font-mono text-xs text-gray-300">{row.endpoint}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    row.status === 200 ? 'bg-[#00D4A6]/10 text-[#00D4A6]' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">{row.ts}</td>
                <td className="px-5 py-3 text-xs text-gray-400 text-right">{row.ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
