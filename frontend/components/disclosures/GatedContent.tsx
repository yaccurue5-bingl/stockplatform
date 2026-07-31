'use client';

/**
 * GatedContent
 * ============
 * /disclosures/[id]의 로그인 전용 섹션(Capital Return 수치 / AI Summary /
 * Key Numbers / Risk Factors). 로그인 상태를 서버 렌더링(getUser()/cookies())이
 * 아닌 클라이언트에서 확인 — 이유: cookies()를 페이지 렌더링 경로에 쓰면
 * Next.js가 라우트 전체를 dynamic으로 강제 전환시켜 revalidate가 무효화됨
 * (모든 방문마다 풀 재계산 → Vercel CPU 급증. /signal/[id]와 동일 원인).
 *
 * 서버는 항상 "비로그인" 버전(블러 + CTA)만 렌더링해 캐시하고, 로그인 유저는
 * 클라이언트에서 /api/disclosures/[id]/full을 호출해 잠긴 콘텐츠를 받아온다.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import CapitalReturnCard, { type BuybackSubtype } from '@/components/CapitalReturnCard';

interface FullContent {
  ai_summary: string | null;
  key_numbers: unknown;
  risk_factors: string | null;
}

interface Props {
  disclosureId: string;
  buybackSubtype: BuybackSubtype | null;
}

function parseKeyNumberLines(raw: unknown): string[] {
  try {
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed as Record<string, string>).map(
        ([k, v]) => `• ${k}: ${v}`
      );
    }
  } catch { /* ignore */ }
  return [];
}

function parseKeyNumberEntries(raw: unknown): Record<string, string> | null {
  try {
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      const obj: Record<string, string> = {};
      parsed.forEach((item: unknown, i: number) => {
        const str = String(item).replace(/^[•\-–]\s*/, '');
        const colonIdx = str.indexOf(':');
        if (colonIdx > 0) {
          obj[str.slice(0, colonIdx).trim()] = str.slice(colonIdx + 1).trim();
        } else {
          obj[`Item ${i + 1}`] = str;
        }
      });
      return Object.keys(obj).length > 0 ? obj : null;
    }
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string>;
  } catch { /* ignore */ }
  return null;
}

function BlurredSection({ title }: { title: string }) {
  return (
    <div className="relative rounded-xl border border-gray-800 bg-gray-900/50 p-5 overflow-hidden">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden>
        <div className="h-3 bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-700 rounded w-4/6" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950/60 backdrop-blur-[2px]">
        <p className="text-xs text-gray-400 font-medium">Sign in to view — free</p>
      </div>
    </div>
  );
}

export default function GatedContent({ disclosureId, buybackSubtype }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [content, setContent] = useState<FullContent | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        fetch(`/api/disclosures/${disclosureId}/full`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: FullContent | null) => setContent(data))
          .catch(() => setContent(null));
      } else {
        setContent(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [disclosureId]);

  const redirectTo = `/disclosures/${disclosureId}`;

  // 로그인 확인 전 / 비로그인 / (로그인했지만 콘텐츠 로딩 중) → 블러 버전
  if (!isLoggedIn || !content) {
    return (
      <>
        {buybackSubtype && (
          <CapitalReturnCard subtype={buybackSubtype} publicKeyNums={[]} />
        )}
        <BlurredSection title="AI Summary" />
        <BlurredSection title="Key Numbers" />
        <BlurredSection title="Risk Factors" />

        {isLoggedIn === false && (
          <>
            <div className="rounded-2xl border border-[#00D4A6]/20 bg-[#00D4A6]/5 p-8 text-center space-y-4">
              <p className="text-lg font-bold">Get full AI analysis</p>
              <p className="text-sm text-gray-400">
                Access AI summaries, key financial figures, and risk assessments for every DART disclosure.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
                  className="px-6 py-2.5 rounded-full bg-[#00D4A6] text-black text-sm font-semibold hover:bg-[#00bfa0] transition"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="px-6 py-2.5 rounded-full border border-gray-700 text-sm font-medium hover:border-gray-500 transition"
                >
                  Create account
                </Link>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">
              Already have access?{' '}
              <Link href="/disclosures" className="text-[#00D4A6] hover:underline">
                View all disclosures →
              </Link>
            </p>
          </>
        )}
      </>
    );
  }

  // 로그인 + 콘텐츠 로드 완료 → 전체 공개
  const keyNumLines   = parseKeyNumberLines(content.key_numbers);
  const keyNumEntries = parseKeyNumberEntries(content.key_numbers);

  return (
    <>
      {buybackSubtype && (
        <CapitalReturnCard subtype={buybackSubtype} publicKeyNums={keyNumLines} />
      )}

      {content.ai_summary && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">AI Summary</p>
          <p className="text-sm text-gray-300 leading-relaxed">{content.ai_summary}</p>
        </div>
      )}

      {keyNumEntries && Object.keys(keyNumEntries).length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">Key Numbers</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(keyNumEntries).map(([k, v]) => (
              <div key={k} className="bg-gray-800/50 rounded-lg px-4 py-3">
                <dt className="text-xs text-gray-500 mb-1">{k}</dt>
                <dd className="text-sm font-semibold text-white">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {content.risk_factors && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">Risk Factors</p>
          <p className="text-sm text-gray-300 leading-relaxed">{content.risk_factors}</p>
        </div>
      )}
    </>
  );
}
