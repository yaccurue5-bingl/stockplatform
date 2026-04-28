import { redirect } from 'next/navigation';

// 플랜 판매 중단 — 트래픽 및 데이터 수집 단계
// Paddle 로직/데이터는 백엔드에 유지됨 (추후 재활성화 가능)
export default function PricingPage() {
  redirect('/');
}
