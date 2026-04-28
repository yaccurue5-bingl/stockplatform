import AppShell from '@/components/app/AppShell';
import MarketRadar from '@/components/landing/MarketRadar';
import HotStocksWidget from '@/components/dashboard/HotStocksWidget';
import { Zap, TrendingUp, FileText, Bell, Clock } from 'lucide-react';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await getUser();
  let userEmail = '';
  let usedToday = 0;
  let usedMonth = 0;
  let recentLogs: Array<{ endpoint: string; status_code: number; created_at: string }> = [];

  if (user) {
    const sb = createServiceClient();
    const now        = new Date();
    const today      = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [profileRes, dailyRes, logRes] = await Promise.all([
      sb.from('users').select('email').eq('id', user.id).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from('api_usage_daily')
        .select('date, call_count')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', today),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from('api_usage_log')
        .select('endpoint, status_code, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    userEmail = profileRes.data?.email ?? user.email ?? '';

    const dailyRows: Array<{ date: string; call_count: number }> = dailyRes.data ?? [];
    usedMonth = dailyRows.reduce((s: number, r: { call_count: number }) => s + (r.call_count ?? 0), 0);
    usedToday = dailyRows.find((r: { date: string }) => r.date === today)?.call_count ?? 0;
    recentLogs = logRes.data ?? [];
  }

  const stats = [
    { label: 'API Calls Today',  value: usedToday.toLocaleString(),  sub: 'Today',          color: '#00D4A6' },
    { label: 'Monthly Usage',    value: usedMonth.toLocaleString(),  sub: 'This month',      color: '#4EA3FF' },
    { label: 'Endpoints',        value: 'All',                       sub: 'Full access',     color: '#a78bfa' },
    { label: 'Access Level',     value: 'Member',                    sub: 'All features on', color: '#fb923c' },
  ];

  return (
    <AppShell title="Dashboard" subtitle={`Welcome back${userEmail ? ', ' + userEmail.split('@')[0] : ''}`}>
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
        {/* Hot Stocks + Market Radar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <HotStocksWidget />
          <MarketRadar />
        </div>

        {/* Usage + Quick Actions */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* API Usage bar */}
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">API Usage — This Month</p>
              <span className="text-xs text-gray-500">resets monthly</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Today: <span className="text-white font-semibold">{usedToday.toLocaleString()}</span> calls</span>
              <span>Month: <span className="text-white font-semibold">{usedMonth.toLocaleString()}</span> calls</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00D4A6]"
                style={{ width: usedMonth > 0 ? `${Math.min(100, Math.round((usedToday / Math.max(usedMonth, 1)) * 100))}%` : '0%' }}
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-4">Quick Actions</p>
            <div className="grid grid-cols-4 gap-3">
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
          <Link href="/usage" className="text-xs text-[#00D4A6] hover:underline">View all →</Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-600 text-sm">
            <p>No API calls yet.</p>
            <p className="text-xs mt-1">Make your first request using your API key.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-5 py-3 font-medium">Endpoint</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Time (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition">
                  <td className="px-5 py-3 font-mono text-xs text-gray-300">{row.endpoint}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.status_code === 200  ? 'bg-[#00D4A6]/10 text-[#00D4A6]'
                      : row.status_code === 429 ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                    }`}>
                      {row.status_code}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 text-right">
                    {new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
