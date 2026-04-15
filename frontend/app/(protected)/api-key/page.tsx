import AppShell from '@/components/app/AppShell';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import { ShieldCheck, KeyRound } from 'lucide-react';
import Link from 'next/link';
import ApiKeyDisplay from '@/components/ApiKeyDisplay';

export default async function ApiKeyPage() {
  const user = await getUser();

  let apiKey: string | null = null;
  let apiKeyCreatedAt: string | null = null;
  let plan = 'free';

  if (user) {
    const sb = createServiceClient();
    const { data } = await sb
      .from('users')
      .select('api_key, api_key_created_at, plan')
      .eq('id', user.id)
      .single();
    apiKey          = data?.api_key ?? null;
    apiKeyCreatedAt = data?.api_key_created_at ?? null;
    plan            = (data?.plan ?? 'free').toLowerCase();
  }

  const createdLabel = apiKeyCreatedAt
    ? new Date(apiKeyCreatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <AppShell title="API Key" subtitle="Your API key for authenticating requests">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-[#00D4A6]/5 border border-[#00D4A6]/20 rounded-xl p-4 mb-6">
        <ShieldCheck size={16} className="text-[#00D4A6] mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Include your key in the{' '}
          <code className="bg-gray-800 text-[#00D4A6] px-1.5 py-0.5 rounded text-[11px]">Authorization</code>{' '}
          header as{' '}
          <code className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[11px]">Bearer YOUR_API_KEY</code>.
          Keep it secret — do not share or commit to version control.
        </p>
      </div>

      {/* Key card */}
      {apiKey ? (
        <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-[#00D4A6]" />
              <p className="text-sm font-semibold text-white">Live API Key</p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#00D4A6]/10 text-[#00D4A6]">
              active
            </span>
          </div>

          <ApiKeyDisplay apiKey={apiKey} />

          {createdLabel && (
            <p className="text-xs text-gray-600 mt-3">Created {createdLabel}</p>
          )}
        </div>
      ) : (
        /* 키 없음 — 무료 플랜 또는 구독 전 */
        <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-8 mb-6 text-center">
          <KeyRound size={28} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400 mb-1">No API key yet</p>
          <p className="text-xs text-gray-600 mb-4">
            {plan === 'free'
              ? 'API keys are available on Developer and Pro plans.'
              : 'Your API key will appear here after subscription is activated.'}
          </p>
          {plan === 'free' && (
            <Link
              href="/pricing"
              className="inline-block px-5 py-2 rounded-full bg-[#00D4A6] text-[#0B0F14] text-xs font-bold hover:bg-[#00bfa0] transition"
            >
              Upgrade Plan →
            </Link>
          )}
        </div>
      )}

      {/* Quick start */}
      {apiKey && (
        <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Quick Start</p>
          <pre className="text-xs text-gray-300 font-mono bg-gray-900/60 rounded-lg p-4 overflow-x-auto leading-relaxed">{`curl https://k-marketinsight.com/api/v1/market-radar \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}</pre>
        </div>
      )}
    </AppShell>
  );
}
