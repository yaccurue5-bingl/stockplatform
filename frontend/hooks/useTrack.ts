'use client';

import { useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase/client';

// 세션 ID: 탭당 1회 생성 (페이지 리로드마다 새로 생성)
const SESSION_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export type EventType =
  | 'page_view'
  | 'disclosure_click'
  | 'stock_click'
  | 'search'
  | 'signal_view'
  | 'api_access_request'
  | 'signup_started'
  | 'login';

interface TrackOptions {
  properties?: Record<string, unknown>;
}

export function useTrack() {
  // 직전 page_view 중복 방지
  const lastPageRef = useRef<string>('');

  const track = useCallback(
    async (eventType: EventType, page: string, options: TrackOptions = {}) => {
      // page_view 중복 방지
      if (eventType === 'page_view' && lastPageRef.current === page) return;
      if (eventType === 'page_view') lastPageRef.current = page;

      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('user_events').insert({
          user_id:    user?.id ?? null,
          session_id: SESSION_ID,
          event_type: eventType,
          page,
          properties: options.properties ?? {},
        } as never);
      } catch {
        // 트래킹 실패는 무시 — 유저 경험 영향 없어야 함
      }
    },
    [],
  );

  return { track };
}
