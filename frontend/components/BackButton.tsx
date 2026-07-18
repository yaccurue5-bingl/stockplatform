import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * 공개 페이지에서 사용 가능한 Back 버튼.
 *
 * ⚠️ router.back() 사용 절대 금지 (CLAUDE.md 영구 규칙):
 * auth redirect(/login?redirectTo=... → Google 계정선택 → OAuth 콜백)가
 * 브라우저 history에 쌓인 상태에서 router.back()을 쓰면, 뒤로가기가
 * 로그인/계정선택 화면으로 계속 돌아가는 버그가 재발한다.
 * 항상 고정된 목적지로 이동한다 (history 추측 금지).
 */
export default function BackButton() {
  return (
    <Link
      href="/disclosures"
      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
    >
      <ArrowLeft size={15} />
      Back
    </Link>
  );
}
