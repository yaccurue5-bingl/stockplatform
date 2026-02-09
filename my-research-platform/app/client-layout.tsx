// app/client-layout.tsx
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import { getSupabase, startSessionTimer, resetSessionTimer, clearSessionTimer } from "@/lib/supabase/client";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
      }
    });

    // 인증 상태 변화 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // 로그인 상태가 아니면 세션 타이머를 시작하지 않음
    if (!isLoggedIn) {
      clearSessionTimer();
      return;
    }

    const handleSessionExpire = () => {
      // 로그아웃 처리
      const supabase = getSupabase();
      supabase.auth.signOut();
      setIsLoggedIn(false);

      // SweetAlert2 팝업 - 버튼 항상 보이도록 스타일 추가
      Swal.fire({
        title: 'Session Expired',
        text: "For your security, you have been logged out due to 30 minutes of inactivity.",
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          confirmButton: 'swal2-confirm-visible'
        }
      }).then(() => {
        router.push("/");
      });
    };

    startSessionTimer(handleSessionExpire);

    const handleActivity = () => {
      if (isLoggedIn) {
        resetSessionTimer(handleSessionExpire);
      }
    };

    // 활동 감지 이벤트
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);

    return () => {
      clearSessionTimer();
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [router, isLoggedIn]);

  return <>{children}</>;
}
