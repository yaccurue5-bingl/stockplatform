// app/client-layout.tsx
'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startSessionTimer, resetSessionTimer, clearSessionTimer } from "@/lib/supabase/client";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleSessionExpire = () => {
      alert("For your security, you have been logged out due to 30 minutes of inactivity.");
      router.push("/auth/login");
    };

    // 초기 타이머 시작
    startSessionTimer(handleSessionExpire);

    // 활동 감지하여 타이머 리셋 (마지막 활동 기준 30분)
    const handleActivity = () => {
      resetSessionTimer(handleSessionExpire);
    };

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