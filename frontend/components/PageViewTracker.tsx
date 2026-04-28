'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTrack } from '@/hooks/useTrack';

/**
 * 레이아웃에 한 번만 마운트하면 모든 페이지 이동 시 page_view 자동 수집.
 * <PageViewTracker /> 를 client layout에 추가.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const { track } = useTrack();

  useEffect(() => {
    track('page_view', pathname);
  }, [pathname, track]);

  return null;
}
