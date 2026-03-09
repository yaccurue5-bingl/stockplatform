'use client';

import { useState, useEffect } from 'react';
import type { Paddle } from '@paddle/paddle-js';

const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_bc7f362776f7ee51f3d70a12ef8';
const PADDLE_PRICE_ID = 'pri_01kk8jf8118g3s9d2ajqk7pbbe';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export default function PaymentModal({ isOpen, onClose, userEmail }: PaymentModalProps) {
  const [paddle, setPaddle] = useState<Paddle | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    import('@paddle/paddle-js').then(({ initializePaddle }) => {
      initializePaddle({
        environment: 'sandbox',
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: (event) => {
          if (event.name === 'checkout.completed') {
            setStatus('success');
          }
        },
      }).then((paddleInstance) => {
        if (paddleInstance) {
          setPaddle(paddleInstance);
        }
      });
    });
  }, [isOpen]);

  const handleCheckout = async () => {
    if (!paddle) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      await paddle.Checkout.open({
        items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
        customer: userEmail ? { email: userEmail } : undefined,
        settings: {
          successUrl: typeof window !== 'undefined'
            ? `${window.location.origin}/?payment=success`
            : undefined,
        },
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
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {status === 'success' ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">구독 완료!</h2>
            <p className="text-gray-400 mb-6">구독이 완료되었습니다. 잠시 후 서비스를 이용하실 수 있습니다.</p>
            <button
              onClick={handleClose}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="p-10">
            {/* INSTANT ACCESS 뱃지 */}
            <div className="flex justify-center mb-6">
              <span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                INSTANT ACCESS
              </span>
            </div>

            {/* 가격 정보 */}
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-white mb-4">AI Analysis Reports</h3>
              <div className="text-6xl font-bold text-white mb-2">$19.99</div>
              <p className="text-blue-200 text-lg">per month</p>
            </div>

            {/* 상품 요약 */}
            <div className="bg-blue-950/30 rounded-xl p-6 mb-8">
              <h4 className="text-white font-semibold mb-3">Product Summary</h4>
              <p className="text-blue-100 text-sm leading-relaxed">
                Get instant access to AI-powered market analysis reports designed to help you make faster, smarter decisions.
              </p>
              <ul className="mt-4 space-y-2 text-blue-100 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  AI-driven insights and structured analysis
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  On-demand digital reports
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Instant access after payment
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  No physical delivery required
                </li>
              </ul>
            </div>

            {/* 기능 목록 */}
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Real-Time Market Analysis</div>
                  <div className="text-sm text-blue-200">AI-powered insights on Korean stocks (KOSPI &amp; KOSDAQ)</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Detailed Stock Analysis</div>
                  <div className="text-sm text-blue-200">Deep dive into company financials and disclosures</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Sentiment Analysis &amp; Predictions</div>
                  <div className="text-sm text-blue-200">AI-driven market sentiment and trend forecasting</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">English Translation</div>
                  <div className="text-sm text-blue-200">Korean disclosures translated to English instantly</div>
                </div>
              </li>
            </ul>

            {/* 환불 보장 */}
            <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="text-sm">
                  <div className="text-green-200 font-semibold mb-1">14-Day Money-Back Guarantee</div>
                  <p className="text-green-100">
                    <strong>No questions asked. Full refund within 14 days of purchase.</strong>
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
              className="block w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg text-center transition-colors shadow-lg flex items-center justify-center gap-2"
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
                'Subscribe - $19.99/month'
              )}
            </button>

            <p className="text-center text-sm text-blue-200 mt-4">
              Secure payment processed by Paddle
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
