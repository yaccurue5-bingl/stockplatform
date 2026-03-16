'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Section from './ui/Section';
import PaymentModal from '@/components/PaymentModal';
import { getSupabase } from '@/lib/supabase/client';

type PlanKey = 'developer' | 'pro';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    desc: 'For individual developers and testing',
    highlight: false,
    cta: 'START FREE',
    ctaStyle: 'border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white',
    isPaid: false,
    planKey: null as PlanKey | null,
    features: [
      '100 API requests / day',
      'Market Radar endpoint',
      'Basic JSON responses',
      'Community support',
    ],
  },
  {
    name: 'Developer',
    price: '$49',
    period: '/month',
    desc: 'For startups, fintech apps, and independent researchers',
    highlight: true,
    cta: 'UPGRADE',
    ctaStyle: 'bg-[#00D4A6] text-[#0B0F14] font-bold hover:bg-[#00bfa0]',
    isPaid: true,
    planKey: 'developer' as PlanKey,
    features: [
      '10,000 API requests / month',
      'Access to all core endpoints',
      'Corporate Events API',
      'Sector Signals API',
      'Market Radar API',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: '$199',
    period: '/month',
    desc: 'For funds, trading platforms, and data teams',
    highlight: false,
    cta: 'PRO PLAN',
    ctaStyle: 'border border-[#4EA3FF]/40 text-[#4EA3FF] hover:border-[#4EA3FF] hover:bg-[#4EA3FF]/5',
    isPaid: true,
    planKey: 'pro' as PlanKey,
    features: [
      '100,000 API requests / month',
      'Full API access',
      'Company Intelligence API',
      'Historical data access',
      'Priority support',
      'Dedicated support channel',
    ],
  },
];

export default function Pricing() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('developer');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // ✅ authReady: onAuthStateChange의 INITIAL_SESSION이 완료되기 전까지 false
  //    → 버튼이 auth 상태 확인 전에 눌리는 race condition 방지
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    // onAuthStateChange는 구독 즉시 INITIAL_SESSION 이벤트를 발생시킴
    // → getUser() 별도 호출 불필요, INITIAL_SESSION으로 초기 상태 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      setUserEmail(session?.user?.email ?? null);
      // 첫 이벤트(INITIAL_SESSION 포함) 수신 시점부터 auth 상태 확정
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePaidPlanClick = (planKey: PlanKey) => {
    if (isLoggedIn) {
      setSelectedPlan(planKey);
      setIsModalOpen(true);
    } else {
      // ✅ redirectTo 전달: 구글 OAuth 포함 로그인 후 pricing 섹션으로 복귀
      router.push('/login?redirectTo=%2F%23pricing');
    }
  };

  return (
    <Section className="bg-[#0B0F14]" id="pricing">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Simple Pricing</h2>
        <p className="text-gray-400">Start free, scale as your usage grows. No hidden fees.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-stretch">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`
              rounded-2xl p-8 flex flex-col gap-6 border
              ${p.highlight
                ? 'bg-[#121821] border-[#00D4A6]/40 ring-1 ring-[#00D4A6]/20 relative'
                : 'bg-[#121821] border-gray-800'}
            `}
          >
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#00D4A6] text-[#0B0F14] text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
            )}

            <div>
              <p className="text-gray-400 text-sm mb-1">{p.name}</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">{p.price}</span>
                <span className="text-gray-500 text-sm mb-1">{p.period}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
            </div>

            <ul className="flex flex-col gap-2.5 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check size={14} className="text-[#00D4A6] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {p.isPaid && p.planKey ? (
              // ✅ authReady 전: 버튼 비활성화로 race condition 방지
              //    authReady 후: 로그인 여부에 따라 모달 오픈 or 로그인 이동
              <button
                onClick={() => handlePaidPlanClick(p.planKey!)}
                disabled={!authReady}
                className={`
                  block w-full text-center text-sm py-3 rounded-xl transition
                  ${authReady
                    ? `cursor-pointer ${p.ctaStyle}`
                    : 'cursor-not-allowed opacity-50 bg-gray-700 text-gray-500'}
                `}
              >
                {authReady ? p.cta : '···'}
              </button>
            ) : !isLoggedIn ? (
              // 비로그인 상태에서만 START FREE 버튼 표시
              <Link
                href="/login"
                className={`
                  block text-center text-sm py-3 rounded-xl transition
                  ${p.ctaStyle}
                `}
              >
                {p.cta}
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      {/* Paddle 결제 모달 */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userEmail={userEmail}
        planType={selectedPlan}
      />
    </Section>
  );
}
