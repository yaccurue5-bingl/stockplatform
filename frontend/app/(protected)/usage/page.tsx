import AppShell from '@/components/app/AppShell';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import Link from 'next/link';

const PLAN_QUOTA: Record<string, { window: 'daily' | 'monthly'; limit: number; label: string }> = {
  free:      { window: 'daily',   limit: 50,     label: 'Free' },
  developer: { window: 'monthly', limit: 8_000,  label: 'Developer' },
  pro:       { window: 'monthly', limit: 80_000, label: 'Pro' },
};

function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

export default async function UsagePage() {
  const user = await getUser();
  let plan = 'free';
  let userId = '';

  if (user) {
    const sb = createServiceClient();
    const { data: profile } = await sb
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single();
    plan   = (profile?.plan ?? 'free').toLowerCase();
    userId = user.id;
  }

  const quota    = PLAN_QUOTA[plan] ?? PLAN_QUOTA.free;
  const now      = new Date();
  const today    = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().slice(0, 10);
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel = resetDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ── 실제 usage 조회 ───────────────────────────────────────────────────────
  let usedToday   = 0;
  let usedMonth   = 0;
  let recentLogs: Array<{ endpoint: string; status_code: number; latency_ms: number; created_at: string }> = [];
  let endpointBreakdown: Record<string, number> = {};
  let dailyBreakdown: Array<{ date: string; calls: number }> = [];

  if (userId) {
    const sb = createServiceClient();

    const [dailyRes, logRes] = await Promise.all([
      // 날짜별 집계
      (sb as any).from('api_usage_daily')
        .select('date, call_count')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lte('date', today)
        .order('date', { ascending: false }),

      // 최근 로그 20건
      (sb as any).from('api_usage_log')
        .select('endpoint, status_code, latency_ms, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const dailyRows: Array<{ date: string; call_count: number }> = dailyRes.data ?? [];
    usedMonth = dailyRows.reduce((s, r) => s + (r.call_count ?? 0), 0);
    usedToday = dailyRows.find(r => r.date === today)?.call_count ?? 0;

    dailyBreakdown = dailyRows
      .slice(0, 14)
      .reverse()
      .map(r => ({ date: r.date.slice(5), calls: r.call_count }));

    recentLogs = ((logRes.data ?? []) as unknown) as typeof recentLogs;

    // 엔드포인트별 집계
    for (const row of recentLogs) {
      endpointBreakdown[row.endpoint] = (endpointBreakdown[row.endpoint] ?? 0) + 1;
    }
  }

  const usedInWindow = quota.window === 'daily' ? usedToday : usedMonth;
  const pct          = quota.limit > 0 ? Math.min(100, Math.round((usedInWindow / quota.limit) * 100)) : 0;
  const avgPerDay    = dailyBreakdown.length > 0
    ? Math.round(dailyBreakdown.reduce((s, r) => s + r.calls, 0) / dailyBreakdown.length)
    : 0;
  const errorCount   = recentLogs.filter(r => r.status_code >= 400).length;
  const errorRate    = recentLogs.length > 0
    ? ((errorCount / recentLogs.length) * 100).toFixed(1) + '%'
    : '—';

  return (
    <AppShell title="Usage" subtitle={`API call analytics — ${monthLabel}`}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total This Month', value: fmtNum(usedMonth),  color: '#00D4A6' },
          { label: 'Today',            value: fmtNum(usedToday),  color: '#4EA3FF' },
          { label: 'Avg / Day',        value: avgPerDay > 0 ? fmtNum(avgPerDay) : '—', color: '#a78bfa' },
          { label: 'Error Rate (log)', value: errorRate,          color: '#fb923c' },
        ].map((s) => (
          <div key={s.label} className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quota bar */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {quota.window === 'daily' ? 'Daily Quota' : 'Monthly Quota'}
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00D4A6]/10 text-[#00D4A6] font-semibold">
              {quota.label}
            </span>
          </div>
          <span className="text-xs font-semibold" style={{ color: pct > 90 ? '#f87171' : pct > 70 ? '#fb923c' : '#6b7280' }}>
            {pct}% used
          </span>
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
          <span>{fmtNum(usedInWindow)} used</span>
          <span>
            {fmtNum(quota.limit)} limit ·
            resets {quota.window === 'daily' ? 'daily' : resetLabel}
          </span>
        </div>
        {plan !== 'pro' && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {plan === 'free'
                ? 'Upgrade for higher limits and real-time signals'
                : 'Upgrade to Pro for 80,000 req/month + bulk endpoints'}
            </p>
            <Link
              href="/pricing"
              className="text-xs px-3 py-1 rounded-full bg-[#00D4A6]/10 text-[#00D4A6] hover:bg-[#00D4A6]/20 transition font-medium"
            >
              Upgrade →
            </Link>
          </div>
        )}
      </div>

      {/* Daily breakdown + endpoint breakdown */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Daily bars (simple CSS) */}
        <div className="lg:col-span-2 bg-[#0d1117] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Daily Calls (last 14 days)</p>
          {dailyBreakdown.length === 0 ? (
            <p className="text-xs text-gray-600 py-8 text-center">No API calls recorded yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {dailyBreakdown.map((d) => {
                const maxCalls = Math.max(...dailyBreakdown.map(r => r.calls), 1);
                const heightPct = Math.max(4, Math.round((d.calls / maxCalls) * 100));
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] text-gray-600 opacity-0 group-hover:opacity-100 transition">
                      {d.calls}
                    </span>
                    <div
                      className="w-full rounded-t bg-[#00D4A6]/60 hover:bg-[#00D4A6] transition"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-gray-600 rotate-45 origin-left">{d.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Endpoint breakdown */}
        <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">By Endpoint (recent 20)</p>
          {Object.keys(endpointBreakdown).length === 0 ? (
            <p className="text-xs text-gray-600 py-8 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(endpointBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([ep, count]) => {
                  const max = Math.max(...Object.values(endpointBreakdown));
                  return (
                    <div key={ep}>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span className="font-mono truncate">{ep}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4EA3FF] rounded-full"
                          style={{ width: `${Math.round((count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Recent log */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">Request Log (last 20)</p>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-600 text-sm">
            No API calls recorded yet. Make your first request using your API key.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-5 py-3 font-medium">Endpoint</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Time (UTC)</th>
                <th className="text-right px-5 py-3 font-medium">Latency</th>
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
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 text-right">
                    {row.latency_ms != null ? `${row.latency_ms}ms` : '—'}
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
