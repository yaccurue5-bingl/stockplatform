'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Section from './ui/Section';
import PaymentModal from '@/components/PaymentModal';
import { getSupabase } from '@/lib/supabase/client';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    desc: 'For individual developers',
    highlight: false,
    cta: 'START',
    ctaStyle: 'border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white',
    isPaid: false,
    features: [
      '100 requests / day',
      'Market Radar endpoint',
      'Community support',
      'JSON responses',
    ],
  },
  {
    name: 'Developer',
    price: '$49',
    period: '/month',
    desc: 'For startups & fintechs',
    highlight: true,
    cta: 'UPGRADE',
    ctaStyle: 'bg-[#00D4A6] text-[#0B0F14] font-bold hover:bg-[#00bfa0]',
    isPaid: true,
    features: [
      '10,000 requests / month',
      'All endpoints',
      'Sector Signals',
      'Corporate Events',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: '$199',
    period: '/month',
    desc: 'For hedge funds & institutions',
    highlight: false,
    cta: 'PRO PLAN',
    ctaStyle: 'border border-[#4EA3FF]/40 text-[#4EA3FF] hover:border-[#4EA3FF] hover:bg-[#4EA3FF]/5',
    isPaid: true,
    features: [
      '100,000 requests / month',
      'All endpoints',
      'Company Intelligence',
      'Historical data access',
      'Priority SLA',
      'Dedicated support',
    ],
  },
];

export default function Pricing() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    // 초기 세션 확인
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
      setUserEmail(data.user?.email ?? null);
    });

    // ✅ 로그인/로그아웃 변화 실시간 감지 (logout 후에도 isLoggedIn 동기화)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePaidPlanClick = () => {
    if (isLoggedIn) {
      setIsModalOpen(true);
    } else {
      router.push('/login');
    }
  };

  return (
    <Section className="bg-[#0B0F14]" id="pricing">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Simple Pricing</h2>
        <p className="text-gray-400">Start free, scale as you grow. No hidden fees.</p>
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

            {p.isPaid ? (
              <button
                onClick={handlePaidPlanClick}
                className={`
                  block w-full text-center text-sm py-3 rounded-xl transition cursor-pointer
                  ${p.ctaStyle}
                `}
              >
                {p.cta}
              </button>
            ) : (
              <Link
                href="/login"
                className={`
                  block text-center text-sm py-3 rounded-xl transition
                  ${p.ctaStyle}
                `}
              >
                {p.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Paddle 결제 모달 */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userEmail={userEmail}
      />
    </Section>
  );
}
