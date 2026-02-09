// app/client-layout.tsx
'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2'; // 설치한 라이브러리 임포트
import { startSessionTimer, resetSessionTimer, clearSessionTimer } from "@/lib/supabase/client";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleSessionExpire = () => {
      // 브라우저 기본 alert 대신 SweetAlert2 사용
      Swal.fire({
        title: 'Session Expired',
        text: "For your security, you have been logged out due to 30 minutes of inactivity.",
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK'
      }).then((result) => {
        router.push("/auth/login");
      });
    };

    startSessionTimer(handleSessionExpire);

    const handleActivity = () => {
      resetSessionTimer(handleSessionExpire);
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
  }, [router]);

  return <>{children}</>;
}