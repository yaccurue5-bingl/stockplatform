'use client';

/**
 * SignalBottomCTA
 * ================
 * /signal/[id] 하단 "Track Korean Market Signals — Free" 카드.
 * 비로그인 방문자에게만 노출 — 로그인 상태를 클라이언트에서 확인
 * (SignalTopActions와 동일한 이유: 서버에서 cookies()를 읽으면 페이지 캐싱이 깨짐).
 * 확인 전(loading)과 로그인 상태에서는 렌더링하지 않음.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';

interface Props {
  stockCode: string | null;
}

export default function SignalBottomCTA({ stockCode }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (isLoggedIn !== false) return null;

  const redirectTo = stockCode ? `/disclosures?stock=${stockCode}` : '/disclosures';

  return (
    <div className="rounded-2xl border border-[#00D4A6]/20 bg-[#00D4A6]/5 p-8 text-center space-y-4">
      <p className="text-lg font-bold">Track Korean Market Signals — Free</p>
      <p className="text-sm text-gray-400">
        Sign up free to access live disclosures, AI analysis, and event filters.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
        <Link
          href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="px-6 py-2.5 rounded-full bg-[#00D4A6] text-black text-sm font-semibold hover:bg-[#00bfa0] transition"
        >
          Sign Up Free →
        </Link>
      </div>
      <p className="text-xs text-gray-600">
        Public Beta · No credit card required
      </p>
    </div>
  );
}
