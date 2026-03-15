'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { Paddle } from '@paddle/paddle-js';

const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_bc7f362776f7ee51f3d70a12ef8';

// ✅ Paddle 상품 ID — 플랜별 분리
const PLAN_CONFIG = {
  developer: {
    priceId: 'pri_01kkr1y9x2m1vj7jkxgser2k5c',
    name: 'Developer Plan',
    price: '$49',
    period: 'per month',
    desc: 'For startups, fintech apps, and independent researchers',
    features: [
      '10,000 API requests / month',
      'Access to all core endpoints',
      'Corporate Events API',
      'Sector Signals API',
      'Market Radar API',
      'Email support',
    ],
    buttonLabel: 'Subscribe — $49/month',
    badgeLabel: 'DEVELOPER',
    badgeClass: 'bg-[#00D4A6] text-[#0B0F14]',
  },
  pro: {
    priceId: 'pri_01kk8jf8118g3s9d2ajqk7pbbe',
    name: 'Pro Plan',
    price: '$199',
    period: 'per month',
    desc: 'For funds, trading platforms, and data teams',
    features: [
      '100,000 API requests / month',
      'Full API access',
      'Company Intelligence API',
      'Historical data access',
      'Priority support',
      'Dedicated support channel',
    ],
    buttonLabel: 'Subscribe — $199/month',
    badgeLabel: 'PRO',
    badgeClass: 'bg-[#4EA3FF] text-white',
  },
} as const;

type PlanType = keyof typeof PLAN_CONFIG;

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  planType?: PlanType;
}

export default function PaymentModal({ isOpen, onClose, userEmail, planType = 'developer' }: PaymentModalProps) {
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const paddleInitialized = useRef(false);

  const plan = PLAN_CONFIG[planType];

  // Paddle은 최초 1회만 초기화 (re-initialization 방지)
  useEffect(() => {
    if (paddleInitialized.current) return;
    paddleInitialized.current = true;

    import('@paddle/paddle-js').then(({ initializePaddle }) => {
      initializePaddle({
        environment: 'sandbox',
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: (event) => {
          if (event.name === 'checkout.completed') {
            // ✅ successUrl 제거: 하드 리로드 방지 → 세션 유지
            // eventCallback으로 처리하여 SPA 내에서 상태 전환
            setStatus('success');
          }
        },
      }).then((paddleInstance) => {
        if (paddleInstance) {
          setPaddle(paddleInstance);
        }
      });
    });
  }, []);

  const handleCheckout = async () => {
    if (!paddle) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      await paddle.Checkout.open({
        items: [{ priceId: plan.priceId, quantity: 1 }],
        customer: userEmail ? { email: userEmail } : undefined,
        // ✅ successUrl 제거: window.location.href 이동 시 TAB_SESSION_ID가 재생성되어
        //    Realtime 중복 감지가 오작동 → 세션 아웃 발생. eventCallback으로 대체.
      });
    } catch {
      setStatus('error');
      setErrorMessage('결제 창을 열 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full relative overflow-y-auto max-h-[90vh]">
        {/* 결제 완료 화면: X 버튼 숨김 (확인 버튼으로만 닫기) */}
        {status !== 'success' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {status === 'success' ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">결제가 성공적으로 진행되었습니다.</h2>
            <p className="text-gray-400 mb-8">주문에 대한 세부 정보는 이메일로 보내드립니다.</p>
            {/* ✅ 확인 버튼: 하드 리로드 없이 dashboard로 이동 → 세션 유지 */}
            <button
              onClick={() => {
                handleClose();
                router.push('/dashboard');
              }}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="p-10">
            {/* 플랜 뱃지 */}
            <div className="flex justify-center mb-6">
              <span className={`px-4 py-1 text-sm font-bold rounded-full ${plan.badgeClass}`}>
                {plan.badgeLabel}
              </span>
            </div>

            {/* 가격 정보 */}
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-white mb-1">{plan.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{plan.desc}</p>
              <div className="text-6xl font-bold text-white mb-2">{plan.price}</div>
              <p className="text-gray-400 text-lg">{plan.period}</p>
            </div>

            {/* 포함 기능 */}
            <div className="bg-gray-800/50 rounded-xl p-6 mb-8">
              <h4 className="text-white font-semibold mb-4">Included in this plan</h4>
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <Check size={15} className="text-[#00D4A6] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* 환불 보장 */}
            <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="text-sm">
                  <div className="text-green-200 font-semibold mb-1">14-Day Money-Back Guarantee</div>
                  <p className="text-green-100">
                    No questions asked. Full refund within 14 days of purchase.
                  </p>
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {status === 'error' && (
              <p className="text-red-400 text-sm mb-4 text-center">{errorMessage}</p>
            )}

            {/* 결제 버튼 */}
            <button
              onClick={handleCheckout}
              disabled={!paddle || isLoading}
              className="flex w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg text-center transition-colors shadow-lg items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  처리 중...
                </>
              ) : !paddle ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  로딩 중...
                </>
              ) : (
                plan.buttonLabel
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Secure payment processed by Paddle
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
