'use client';

import AppShell from '@/components/app/AppShell';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const dailyData = [
  { day: 'Mar 1',  calls: 820  },
  { day: 'Mar 2',  calls: 940  },
  { day: 'Mar 3',  calls: 760  },
  { day: 'Mar 4',  calls: 1100 },
  { day: 'Mar 5',  calls: 1280 },
  { day: 'Mar 6',  calls: 1050 },
  { day: 'Mar 7',  calls: 890  },
  { day: 'Mar 8',  calls: 1320 },
  { day: 'Mar 9',  calls: 1480 },
  { day: 'Mar 10', calls: 1390 },
  { day: 'Mar 11', calls: 1620 },
  { day: 'Mar 12', calls: 1540 },
  { day: 'Mar 13', calls: 1710 },
  { day: 'Mar 14', calls: 1284 },
];

const endpointData = [
  { name: '/v1/events',         calls: 18420 },
  { name: '/v1/sector-signals', calls: 10830 },
  { name: '/v1/market-radar',   calls: 6210  },
  { name: '/v1/company',        calls: 2942  },
];

const summaryStats = [
  { label: 'Total This Month', value: '38,402', color: '#00D4A6' },
  { label: 'Today',            value: '1,284',  color: '#4EA3FF' },
  { label: 'Avg / Day',        value: '2,743',  color: '#a78bfa' },
  { label: 'Error Rate',       value: '0.3%',   color: '#fb923c' },
];

const tooltipStyle = {
  contentStyle: {
    background: '#121821',
    border: '1px solid #374151',
    borderRadius: '8px',
    fontSize: '11px',
  },
  itemStyle: { color: '#00D4A6' },
  labelStyle: { color: '#9ca3af' },
};

export default function UsagePage() {
  const used = 38402;
  const limit = 50000;
  const pct = Math.round((used / limit) * 100);

  return (
    <AppShell title="Usage" subtitle="API call statistics for March 2026">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryStats.map((s) => (
          <div key={s.label} className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quota bar */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Monthly Quota</p>
          <span className="text-xs font-semibold text-[#00D4A6]">{pct}% used</span>
        </div>
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct > 90 ? '#f87171' : pct > 70 ? '#fb923c' : '#00D4A6',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{used.toLocaleString()} calls used</span>
          <span>{limit.toLocaleString()} limit · resets Apr 1</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Daily line chart */}
        <div className="lg:col-span-2 bg-[#0d1117] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Daily API Calls</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [`${Number(v).toLocaleString()}`, 'Calls']}
              />
              <Line
                type="monotone"
                dataKey="calls"
                stroke="#00D4A6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#00D4A6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Endpoint bar chart */}
        <div className="lg:col-span-1 bg-[#0d1117] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">By Endpoint</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={endpointData}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [`${Number(v).toLocaleString()}`, 'Calls']}
              />
              <Bar dataKey="calls" fill="#4EA3FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent log table */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">Request Log</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left px-5 py-3 font-medium">Endpoint</th>
              <th className="text-left px-5 py-3 font-medium">Method</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Time (KST)</th>
              <th className="text-right px-5 py-3 font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {[
              { ep: '/v1/events',         method: 'GET', status: 200, ts: '2026-03-14 14:31:02', ms: 138 },
              { ep: '/v1/sector-signals', method: 'GET', status: 200, ts: '2026-03-14 14:30:47', ms: 95  },
              { ep: '/v1/market-radar',   method: 'GET', status: 200, ts: '2026-03-14 14:29:12', ms: 201 },
              { ep: '/v1/company/005930', method: 'GET', status: 200, ts: '2026-03-14 14:28:55', ms: 119 },
              { ep: '/v1/events',         method: 'GET', status: 429, ts: '2026-03-14 14:27:30', ms: 12  },
              { ep: '/v1/sector-signals', method: 'GET', status: 200, ts: '2026-03-14 14:26:18', ms: 87  },
              { ep: '/v1/company/000660', method: 'GET', status: 200, ts: '2026-03-14 14:25:03', ms: 143 },
              { ep: '/v1/market-radar',   method: 'GET', status: 200, ts: '2026-03-14 14:23:41', ms: 178 },
            ].map((row, i) => (
              <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition">
                <td className="px-5 py-3 font-mono text-xs text-gray-300">{row.ep}</td>
                <td className="px-5 py-3 text-xs text-gray-500">{row.method}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    row.status === 200
                      ? 'bg-[#00D4A6]/10 text-[#00D4A6]'
                      : row.status === 429
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
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
