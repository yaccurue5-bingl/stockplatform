import AppShell from '@/components/app/AppShell';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import Link from 'next/link';

const PLAN_QUOTA: Record<string, { monthly: number | null; dailyFree: number | null; label: string }> = {
  free:      { monthly: null,  dailyFree: 50,   label: 'Free' },
  developer: { monthly: 8000,  dailyFree: null, label: 'Developer' },
  pro:       { monthly: 80000, dailyFree: null, label: 'Pro' },
};

export default async function UsagePage() {
  const user = await getUser();
  let plan = 'free';

  if (user) {
    const sb = createServiceClient();
    const { data: profile } = await sb
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single();
    plan = (profile?.plan ?? 'free').toLowerCase();
  }

  const quota = PLAN_QUOTA[plan] ?? PLAN_QUOTA.free;
  const usedCalls = 0; // TODO: 실제 usage tracking 구현 후 교체

  const now        = new Date();
  const resetDate  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel = resetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const limitNum   = quota.monthly ?? (quota.dailyFree! * 30);
  const pct        = limitNum > 0 ? Math.round((usedCalls / limitNum) * 100) : 0;
  const limitLabel = quota.monthly
    ? `${quota.monthly.toLocaleString()} / month`
    : `${quota.dailyFree} / day`;

  return (
    <AppShell title="Usage" subtitle={`API call statistics for ${monthLabel}`}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total This Month', value: '—',          color: '#00D4A6' },
          { label: 'Today',            value: '—',          color: '#4EA3FF' },
          { label: 'Avg / Day',        value: '—',          color: '#a78bfa' },
          { label: 'Error Rate',       value: '—',          color: '#fb923c' },
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
              {quota.monthly ? 'Monthly Quota' : 'Daily Quota'}
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00D4A6]/10 text-[#00D4A6] font-semibold">
              {quota.label}
            </span>
          </div>
          <span className="text-xs font-semibold text-gray-500">{pct}% used</span>
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
          <span>{usedCalls.toLocaleString()} calls used</span>
          <span>{limitLabel} · resets {quota.monthly ? resetLabel : 'daily'}</span>
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

      {/* Usage tracking coming soon */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-10 text-center text-gray-600">
        <p className="text-base font-semibold text-gray-500 mb-2">Usage Analytics Coming Soon</p>
        <p className="text-sm">
          Detailed per-day and per-endpoint call charts will appear here once usage tracking is enabled.
        </p>
        <p className="text-xs mt-4 text-gray-700">
          Your API calls are being processed. Quota limits are enforced per plan.
        </p>
      </div>
    </AppShell>
  );
}
