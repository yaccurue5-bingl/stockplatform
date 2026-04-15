'use client';

import { useState } from 'react';
import PaymentModal from '@/components/PaymentModal';

interface Props {
  userEmail?: string | null;
  userId?: string | null;
}

/**
 * $1 테스트 결제 카드 — NEXT_PUBLIC_PADDLE_PRICE_ID_test 있을 때만 렌더
 * Pricing 페이지 하단에 임시 삽입. 테스트 완료 후 제거.
 */
export default function TestPlanCard({ userEmail, userId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-10 max-w-sm mx-auto rounded-2xl border-2 border-yellow-500/50 bg-yellow-500/5 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-black rounded">TEST ONLY</span>
          <span className="text-xs text-gray-500">결제 연동 확인용 · 실 서비스 비노출</span>
        </div>
        <p className="text-2xl font-black text-white mb-1">$1 Test Checkout</p>
        <p className="text-sm text-gray-400 mb-4">
          Paddle 결제 → Webhook → DB 저장 확인용
        </p>
        <ul className="text-xs text-gray-500 space-y-1 mb-5">
          <li>✓ subscription.created 웹훅 발생</li>
          <li>✓ subscriptions 테이블 저장 확인</li>
          <li>✓ users.plan → developer 전환 확인</li>
        </ul>
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold transition"
        >
          Pay $1 (Live Test)
        </button>
      </div>

      <PaymentModal
        isOpen={open}
        onClose={() => setOpen(false)}
        userEmail={userEmail}
        userId={userId}
        planType="test"
      />
    </>
  );
}
