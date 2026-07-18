'use client';

/**
 * SignalTopActions
 * ================
 * /signal/[id] 상단 네비의 북마크 버튼 + "Sign in" 링크.
 * 로그인 상태를 서버 렌더링(getUser()/cookies())이 아닌 클라이언트에서 확인 —
 * 이유: cookies()를 페이지 렌더링 경로에 쓰면 Next.js가 라우트 전체를 dynamic으로
 * 강제 전환시켜 revalidate가 무효화됨 (모든 방문마다 풀 재계산 → Vercel CPU 급증).
 *
 * redirectTo는 항상 이 페이지 자기 자신(/signal/{id}) — 로그인 후 다른 화면으로
 * 튕기지 않고 보고 있던 화면 그대로 이어짐 (구 UI로 분기되던 버그 방지).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import BookmarkButton from '@/components/BookmarkButton';

interface Props {
  disclosureId: string;
}

export default function SignalTopActions({ disclosureId }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bookmarked, setBookmarked]  = useState(false);
  const [ready, setReady]            = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        fetch(`/api/bookmarks?disclosure_id=${disclosureId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { bookmarked?: boolean } | null) => setBookmarked(!!data?.bookmarked))
          .catch(() => setBookmarked(false))
          .finally(() => setReady(true));
      } else {
        setBookmarked(false);
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [disclosureId]);

  const redirectTo = `/signal/${disclosureId}`;

  return (
    <div className="flex items-center gap-3">
      {/* ready 전환 시 key가 바뀌면서 BookmarkButton이 정확한 초기 상태로 재마운트됨 */}
      <BookmarkButton
        key={ready ? 'resolved' : 'loading'}
        disclosureId={disclosureId}
        initialBookmarked={bookmarked}
        isLoggedIn={isLoggedIn}
        size="sm"
      />
      {ready && !isLoggedIn && (
        <Link
          href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="text-xs text-[#00D4A6] hover:underline shrink-0"
        >
          Sign in for full access →
        </Link>
      )}
    </div>
  );
}
