'use client';

/**
 * BookmarkButton
 * ==============
 * 공시 시그널 북마크 토글 버튼.
 * - 로그인 상태: POST /api/bookmarks → optimistic toggle
 * - 비로그인: /login 리다이렉트
 */

import { useState, useTransition } from 'react';
import { Bookmark } from 'lucide-react';

interface BookmarkButtonProps {
  disclosureId: string;
  initialBookmarked: boolean;
  isLoggedIn: boolean;
  /** 버튼 크기 변형 */
  size?: 'sm' | 'md';
}

export default function BookmarkButton({
  disclosureId,
  initialBookmarked,
  isLoggedIn,
  size = 'md',
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!isLoggedIn) {
      const redirect = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?redirectTo=${redirect}`;
      return;
    }

    // Optimistic update
    const next = !bookmarked;
    setBookmarked(next);

    startTransition(async () => {
      try {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disclosure_id: disclosureId }),
        });
        if (res.ok) {
          const { bookmarked: serverState } = await res.json() as { bookmarked: boolean };
          setBookmarked(serverState);
        } else {
          // 서버 실패 시 롤백
          setBookmarked(!next);
        }
      } catch {
        setBookmarked(!next);
      }
    });
  }

  const iconSize = size === 'sm' ? 14 : 16;
  const btnSize  = size === 'sm'
    ? 'p-1.5 rounded-md'
    : 'p-2 rounded-lg';

  const label = bookmarked
    ? 'Remove bookmark'
    : isLoggedIn
    ? 'Bookmark this signal'
    : 'Sign in to bookmark';

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={label}
      aria-label={label}
      aria-pressed={bookmarked}
      className={`
        ${btnSize}
        border transition-colors duration-150
        ${bookmarked
          ? 'border-[#00D4A6]/40 bg-[#00D4A6]/10 text-[#00D4A6] hover:bg-[#00D4A6]/20'
          : 'border-gray-700 bg-transparent text-gray-500 hover:text-gray-300 hover:border-gray-500'
        }
        ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Bookmark
        size={iconSize}
        className={bookmarked ? 'fill-[#00D4A6]' : ''}
      />
    </button>
  );
}
