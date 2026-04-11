// app/client-layout.tsx
'use client';

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import { getSupabase, startSessionTimer, resetSessionTimer, clearSessionTimer, checkSessionExpiry } from "@/lib/supabase/client";

// 탭마다 고유한 세션 ID 생성 (페이지 로드 시 1회 고정)
// → 같은 브라우저의 다른 탭도 서로 다른 ID를 가짐
const TAB_SESSION_ID = crypto.randomUUID();

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const registeredUserIdRef = useRef<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtimeChannelRef = useRef<any>(null);
  // React StrictMode 이중 실행 방지 (개발 모드에서 useEffect가 2번 실행됨)
  const isMountedRef = useRef(false);

  // ────────────────────────────────────────────────────────────────
  // 1. 인증 상태 관리 + FIFO 세션 등록
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // StrictMode 이중 실행 시 두 번째 실행만 유효하게 처리
    isMountedRef.current = true;
    const supabase = getSupabase();

    // onAuthStateChange만 사용 (getSession 중복 호출 제거)
    // INITIAL_SESSION: 이미 로그인된 상태로 탭 열기/새로고침
    // SIGNED_IN: 로그인 버튼 클릭
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMountedRef.current) return;

      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        // async 함수이므로 void로 명시적 처리 (onAuthStateChange 콜백은 동기)
        void registerSession(session.user.id);
      }

      if (event === 'SIGNED_OUT') {
        currentSessionIdRef.current = null;
        registeredUserIdRef.current = null;
        cleanupRealtime();
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      cleanupRealtime();
    };
  }, []);

  // ────────────────────────────────────────────────────────────────
  // 세션 등록: last_session_id를 탭 고유 UUID로 업데이트 후
  //           Realtime으로 변경 감지 → 다른 탭/기기 로그인 시 강제 로그아웃
  //
  // [핵심] access_token이 아닌 TAB_SESSION_ID(crypto.randomUUID) 사용
  //        → 같은 브라우저 다른 탭도 서로 다른 ID → 감지 가능
  // ────────────────────────────────────────────────────────────────
  async function registerSession(userId: string) {
    // 이미 이 탭에서 동일 유저로 Realtime 구독 중이면 재등록 스킵
    // TAB_SESSION_ID가 이미 등록된 경우만 스킵 (중복 호출 방지)
    if (
      realtimeChannelRef.current !== null &&
      registeredUserIdRef.current === userId &&
      currentSessionIdRef.current === TAB_SESSION_ID
    ) {
      return;
    }

    // unmount된 경우 중단
    if (!isMountedRef.current) return;

    const sessionId = TAB_SESSION_ID;

    // 기존 채널 먼저 정리 (새 채널 등록 전)
    cleanupRealtime();

    // ref 업데이트
    currentSessionIdRef.current = sessionId;
    registeredUserIdRef.current = userId;

    const supabase = getSupabase();

    // DB에 이 탭의 고유 세션 ID 기록
    await supabase
      .from('users')
      .update({ last_session_id: sessionId } as never)
      .eq('id', userId);

    // unmount 중에 await가 끝난 경우 중단
    if (!isMountedRef.current) return;

    // Realtime으로 users 테이블의 last_session_id 변경 감지
    const channel = supabase
      .channel(`session-watch:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newSessionId = (payload.new as any)?.last_session_id;
          // DB의 세션 ID가 현재 기기와 다르면 → 다른 기기에서 로그인됨
          if (newSessionId && newSessionId !== currentSessionIdRef.current) {
            forceLogout('duplicate');
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel as any;
  }

  function cleanupRealtime() {
    if (realtimeChannelRef.current) {
      const supabase = getSupabase();
      supabase.removeChannel(realtimeChannelRef.current as any);
      realtimeChannelRef.current = null;
    }
  }

  async function forceLogout(reason: 'duplicate' | 'expired') {
    const supabase = getSupabase();
    cleanupRealtime();
    clearSessionTimer();
    await supabase.auth.signOut();
    setIsLoggedIn(false);

    if (reason === 'duplicate') {
      await Swal.fire({
        title: 'Signed In on Another Device',
        text: 'For security, this session has been terminated. Your account can only be used on one device at a time.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
    } else {
      await Swal.fire({
        title: 'Session Expired',
        text: 'You have been logged out due to 30 minutes of inactivity.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: { confirmButton: 'swal2-confirm-visible' },
      });
    }

    router.push('/');
  }

  // ────────────────────────────────────────────────────────────────
  // 2. 세션 타임아웃 (30분 비활동)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      clearSessionTimer();
      return;
    }

    const handleSessionExpire = () => forceLogout('expired');

    startSessionTimer(handleSessionExpire);

    const handleActivity = () => {
      if (isLoggedIn) resetSessionTimer(handleSessionExpire);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoggedIn) {
        checkSessionExpiry(handleSessionExpire);
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearSessionTimer();
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn]);

  // ────────────────────────────────────────────────────────────────
  // 3. 콘텐츠 보호: 복사/드래그/우클릭 금지 + 화면 캡처 감지
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // CSS protected-mode 클래스 토글
    if (isLoggedIn) {
      document.body.classList.add('protected-mode');
    } else {
      document.body.classList.remove('protected-mode');
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    // --- 3-1. 우클릭 금지 ---
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // --- 3-2. 드래그 선택 금지 ---
    const blockSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // --- 3-3. 복사/붙여넣기/잘라내기 단축키 차단 ---
    const blockCopyKeys = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+S, Ctrl+P (인쇄)
      if (ctrl && ['c', 'a', 'x', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // PrintScreen 키 감지
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        handleScreenCapture();
        return false;
      }
      // F12 개발자도구 차단
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (개발자도구)
      if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    };

    // --- 3-4. 드래그 시작 금지 ---
    const blockDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // --- 3-5. 화면 캡처/녹화 감지 ---
    // Screen Capture API (Chrome 94+): 화면 공유/녹화 감지
    // NOTE: blur→focus 300ms 감지는 제거 — Google Translate 팝업 닫기 등
    //       브라우저 이벤트와 구분 불가능하여 오탐 발생
    // getDisplayMedia를 사용 중이면 navigator.mediaDevices로 감지
    let displayStream: MediaStream | null = null;
    const origGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
    if (origGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async (constraints) => {
        const stream = await origGetDisplayMedia(constraints);
        displayStream = stream;
        handleScreenCapture();
        stream.getTracks().forEach(track => {
          track.addEventListener('ended', () => { displayStream = null; });
        });
        return stream;
      };
    }

    // document.oncopy 차단
    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('selectstart', blockSelectStart);
    document.addEventListener('keydown', blockCopyKeys);
    document.addEventListener('dragstart', blockDragStart);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCopy);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('selectstart', blockSelectStart);
      document.removeEventListener('keydown', blockCopyKeys);
      document.removeEventListener('dragstart', blockDragStart);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      // 화면 공유 스트림 종료
      if (displayStream) {
        displayStream.getTracks().forEach(track => track.stop());
      }
      // getDisplayMedia 원복
      if (origGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = origGetDisplayMedia;
      }
    };
  }, [isLoggedIn]);

  function handleScreenCapture() {
    // 캡처 감지 시 화면을 즉시 블랙아웃
    document.body.classList.add('capture-detected');

    Swal.fire({
      title: 'Screen Capture Detected',
      text: 'Screen capture is restricted to protect content. Unauthorized reproduction violates our Terms of Service.',
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    }).then(() => {
      document.body.classList.remove('capture-detected');
    });
  }

  return <>{children}</>;
}
