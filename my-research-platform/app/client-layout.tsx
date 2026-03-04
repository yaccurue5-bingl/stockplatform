// app/client-layout.tsx
'use client';

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import { getSupabase, startSessionTimer, resetSessionTimer, clearSessionTimer, checkSessionExpiry } from "@/lib/supabase/client";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtimeChannelRef = useRef<any>(null);

  // ────────────────────────────────────────────────────────────────
  // 1. 인증 상태 관리 + FIFO 세션 등록
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
        registerSession(session.user.id, session.access_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);

      if (event === 'SIGNED_IN' && session?.user) {
        registerSession(session.user.id, session.access_token);
      }

      if (event === 'SIGNED_OUT') {
        currentSessionIdRef.current = null;
        cleanupRealtime();
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupRealtime();
    };
  }, []);

  // ────────────────────────────────────────────────────────────────
  // 세션 등록: last_session_id를 현재 access_token으로 업데이트 후
  //           Realtime으로 변경 감지 → 다른 기기 로그인 시 강제 로그아웃
  // ────────────────────────────────────────────────────────────────
  async function registerSession(userId: string, accessToken: string) {
    // access_token 앞 32자를 session fingerprint로 사용 (전체 JWT 저장 불필요)
    const sessionId = accessToken.slice(0, 32);
    currentSessionIdRef.current = sessionId;

    const supabase = getSupabase();

    // DB에 현재 세션 ID 기록
    await supabase
      .from('users')
      .update({ last_session_id: sessionId } as any)
      .eq('id', userId);

    // 기존 Realtime 채널 정리 후 재구독
    cleanupRealtime();

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
        title: '다른 기기에서 로그인됨',
        text: '보안을 위해 이 기기의 세션이 종료되었습니다. 계정은 한 기기에서만 사용할 수 있습니다.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: '확인',
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
    } else {
      await Swal.fire({
        title: 'Session Expired',
        text: '30분 동안 활동이 없어 보안을 위해 로그아웃되었습니다.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: '확인',
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
    // PrintScreen: 짧은 blur→focus 사이클(300ms 이내) 유발
    let captureBlurTime: number | null = null;

    const handleWindowBlur = () => {
      captureBlurTime = Date.now();
    };

    const handleWindowFocus = () => {
      if (captureBlurTime !== null) {
        const elapsed = Date.now() - captureBlurTime;
        if (elapsed < 300) {
          handleScreenCapture();
        }
        captureBlurTime = null;
      }
    };

    // Screen Capture API (Chrome 94+): 화면 공유/녹화 감지
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
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('selectstart', blockSelectStart);
      document.removeEventListener('keydown', blockCopyKeys);
      document.removeEventListener('dragstart', blockDragStart);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
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
      title: '화면 캡처 감지',
      text: '콘텐츠 보호를 위해 화면 캡처가 제한됩니다. 무단 복제는 이용약관 위반입니다.',
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: '확인',
      allowOutsideClick: false,
    }).then(() => {
      document.body.classList.remove('capture-detected');
    });
  }

  return <>{children}</>;
}
