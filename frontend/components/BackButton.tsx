'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * 공개 페이지에서 사용 가능한 Back 버튼.
 * router.back()을 사용해 이전 히스토리(랜딩 or /disclosures)로 이동.
 * href="/disclosures" 하드코딩 시 비로그인 사용자가 로그인 페이지로 리다이렉트되는 버그 방지.
 */
export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
    >
      <ArrowLeft size={15} />
      Back
    </button>
  );
}
