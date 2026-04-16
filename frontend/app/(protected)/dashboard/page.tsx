import AppShell from '@/components/app/AppShell';
import MarketRadar from '@/components/landing/MarketRadar';
import { Zap, TrendingUp, FileText, Bell, Clock } from 'lucide-react';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import Link from 'next/link';
import ManageBillingButton from '@/components/ManageBillingButton';

// 플랜별 월 quota (free는 일 50건)
const PLAN_QUOTA: Record<string, { monthly: number | null; dailyFree: number | null; label: string }> = {
  free:      { monthly: null,   dailyFree: 50,    label: 'Free' },
  developer: { monthly: 10000,  dailyFree: null,  label: 'Developer' },
  pro:       { monthly: 100000, dailyFree: null,  label: 'Pro' },
};

export default async function DashboardPage() {
  // 실제 유저 + 플랜 조회
  const user = await getUser();
  let plan = 'free';
  let userEmail = '';

  let hasActiveSub = false;
  let nextBillingDate: string | null = null;
  let usedToday = 0;
  let usedMonth = 0;
  let recentLogs: Array<{ endpoint: string; status_code: number; created_at: string }> = [];

  if (user) {
    const sb = createServiceClient();
    const now        = new Date();
    const today      = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [profileRes, subRes, dailyRes, logRes] = await Promise.all([
      sb.from('users').select('plan, email').eq('id', user.id).single(),
      sb.from('subscriptions')
        .select('status, plan_type, next_billing_date')
        .eq('user_id', user.id)
        .in('status', ['active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
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

    plan            = (profileRes.data?.plan ?? 'free').toLowerCase();
    userEmail       = profileRes.data?.email ?? user.email ?? '';
    hasActiveSub    = !!subRes.data;
    nextBillingDate = subRes.data?.next_billing_date ?? null;

    const dailyRows: Array<{ date: string; call_count: number }> = dailyRes.data ?? [];
    usedMonth = dailyRows.reduce((s: number, r: { call_count: number }) => s + (r.call_count ?? 0), 0);
    usedToday = dailyRows.find((r: { date: string }) => r.date === today)?.call_count ?? 0;
    recentLogs = logRes.data ?? [];
  }

  const quota = PLAN_QUOTA[plan] ?? PLAN_QUOTA.free;

  // quota 표시용 (실제 usage tracking 미구현 → 0 표시)
  const usedCalls  = 0;
  const limitLabel = quota.monthly
    ? `${quota.monthly.toLocaleString()} / month`
    : `${quota.dailyFree} / day`;
  const limitNum   = quota.monthly ?? (quota.dailyFree! * 30);
  const usedPct    = limitNum > 0 ? Math.round((usedCalls / limitNum) * 100) : 0;

  // 현재 월 계산
  const now          = new Date();
  const resetDate    = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel   = resetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // 남은 일수 계산
  const daysRemaining = nextBillingDate
    ? Math.max(0, Math.ceil((new Date(nextBillingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const stats = [
    { label: 'API Calls Today',  value: usedToday.toLocaleString(),  sub: `Limit: ${quota.dailyFree ?? limitLabel}`, color: '#00D4A6' },
    { label: 'Monthly Usage',    value: usedMonth.toLocaleString(),  sub: `Limit: ${limitLabel}`,                   color: '#4EA3FF' },
    { label: 'Active Endpoints', value: plan === 'free' ? '1' : plan === 'developer' ? '4' : '5+',
                                                                     sub: plan === 'free' ? 'Basic only' : 'All core endpoints', color: '#a78bfa' },
    { label: 'Current Plan',     value: quota.label,                 sub: limitLabel,                               color: '#fb923c' },
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
        {/* Market Radar */}
        <div className="lg:col-span-1">
          <MarketRadar />
        </div>

        {/* Quota + Quick Actions */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Quota bar */}
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">
                {quota.monthly ? 'Monthly Quota' : 'Daily Quota'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#00D4A6]/10 text-[#00D4A6] font-semibold">
                  {quota.label} Plan
                </span>
                <span className="text-xs text-gray-500">
                  resets {quota.monthly ? resetLabel : 'daily'}
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-[#00D4A6]"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{usedCalls.toLocaleString()} used</span>
              <span>{limitLabel}</span>
            </div>
            {plan === 'free' && (
              <div className="mt-3 text-xs text-gray-600">
                <Link href="/pricing" className="text-[#00D4A6] hover:underline">
                  Upgrade to Developer → 8,000 req/month
                </Link>
              </div>
            )}
            {plan === 'developer' && (
              <div className="mt-3 text-xs text-gray-600">
                <Link href="/pricing" className="text-[#00D4A6] hover:underline">
                  Upgrade to Pro → 80,000 req/month + bulk endpoints
                </Link>
              </div>
            )}
          </div>

          {/* 구독 관리 (유료 플랜만) */}
          {hasActiveSub && (
            <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white capitalize">{quota.label} Plan</p>
                  {nextBillingDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Next billing: {new Date(nextBillingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      {daysRemaining !== null && (
                        <span className={`ml-2 font-semibold ${daysRemaining <= 3 ? 'text-red-400' : 'text-[#00D4A6]'}`}>
                          (D-{daysRemaining})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <ManageBillingButton />
              </div>
              {/* 남은 기간 프로그레스바 */}
              {daysRemaining !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                    <span>{daysRemaining}일 남음</span>
                    <span>30일 기준</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${daysRemaining <= 3 ? 'bg-red-400' : 'bg-[#00D4A6]'}`}
                      style={{ width: `${Math.min(100, Math.round((daysRemaining / 30) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

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
