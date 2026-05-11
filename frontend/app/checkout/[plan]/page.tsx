/**
 * /checkout/[plan]  — Hidden checkout pages
 *
 * Supported plans: starter, pro
 *
 * Flow:
 *  1. Middleware redirects unauthenticated users to /login?redirectTo=/checkout/[plan]
 *  2. Server component reads user session + price IDs
 *  3. Renders CheckoutClient (Paddle overlay)
 *  4. On success → Paddle webhook fires → users.api_key assigned
 */

import { notFound } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import Navbar from '@/components/landing/Navbar';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type SupportedPlan = 'starter' | 'pro';
const SUPPORTED_PLANS: SupportedPlan[] = ['starter', 'pro'];

function getPriceId(plan: SupportedPlan): string {
  if (plan === 'pro') return process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO ?? '';
  return process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STARTER ?? '';
}

const PAGE_TITLE: Record<SupportedPlan, string> = {
  starter: 'Starter Plan — $99/mo',
  pro:     'Pro Plan — $299/mo',
};

export async function generateMetadata({ params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  const planTyped = plan as SupportedPlan;
  if (!SUPPORTED_PLANS.includes(planTyped)) return {};
  return {
    title: `Checkout: ${PAGE_TITLE[planTyped]} — K-MarketInsight`,
    robots: 'noindex',  // hidden page — 검색 노출 방지
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan: planParam } = await params;
  const plan = planParam as SupportedPlan;
  if (!SUPPORTED_PLANS.includes(plan)) notFound();

  // 사용자 정보 (미들웨어가 이미 인증을 보장하지만 방어 코드)
  const user = await getUser();
  if (!user) notFound();

  const priceId     = getPriceId(plan);
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';
  // sandbox 자동 감지: 'test_' 토큰이면 sandbox, 'live_'이면 production
  const isSandbox   = clientToken.startsWith('test_');

  // 가격 ID 또는 토큰 누락 시 명확한 오류
  const configMissing = !priceId || !clientToken;

  return (
    <div className="bg-[#0B0F14] min-h-screen text-gray-200">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href="/api-docs"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition mb-8"
        >
          <ArrowLeft size={13} />
          Back to API Docs
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">
            Unlock Full API Access
          </h1>
          <p className="text-sm text-gray-400">
            You&apos;re signed in as <span className="text-gray-300">{user.email}</span>
          </p>
        </div>

        {configMissing ? (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm mb-2">Checkout is temporarily unavailable.</p>
            <p className="text-gray-500 text-xs">
              Please{' '}
              <a href="/api-access" className="text-[#00D4A6] hover:underline">
                contact us
              </a>{' '}
              to complete your upgrade.
            </p>
          </div>
        ) : (
          <CheckoutClient
            userId={user.id}
            userEmail={user.email ?? ''}
            plan={plan}
            priceId={priceId}
            clientToken={clientToken}
            isSandbox={isSandbox}
          />
        )}
      </div>
    </div>
  );
}
