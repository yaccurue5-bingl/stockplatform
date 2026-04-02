/**
 * currency.ts — KRW ↔ USD 변환 유틸
 *
 * 원칙:
 *   - USD 기본 표시 (외국인 UX)
 *   - KRW 보조 표시 (한국 데이터 신뢰 유지)
 *   - 단위 무조건 축약 ($6.6M, not $6,600,000)
 *
 * 환율: 하드코딩 (MVP). 추후 실시간 FX API 연동 가능.
 */

export const KRW_TO_USD = 0.00066; // ≈ ₩1,515/$1

/** KRW → USD 변환 */
export function toUSD(krw: number): number {
  return krw * KRW_TO_USD;
}

/**
 * USD 금액 축약 포맷
 * 1B+ → $X.XB / 1M+ → $X.XM / 1K+ → $X.XK / else → $X
 */
export function formatUSD(usd: number): string {
  const abs = Math.abs(usd);
  const sign = usd < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * KRW 금액 축약 포맷 (보조 표시용)
 * 1T+ → ₩X.XT / 1B+ → ₩X.XB / 1M+ → ₩X.XM / else → ₩X
 *
 * (단위: 한국식 조/억/만 아닌 국제 T/B/M 사용 — 혼용 방지)
 */
export function formatKRW(krw: number): string {
  const abs = Math.abs(krw);
  const sign = krw < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}₩${(abs / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000)     return `${sign}₩${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)         return `${sign}₩${(abs / 1_000_000).toFixed(0)}M`;
  return `${sign}₩${abs.toLocaleString()}`;
}

/**
 * 듀얼 표시: "$6.6M (₩10B)"
 * USD primary + KRW secondary — 글로벌 + 신뢰 동시 달성
 */
export function formatDual(krw: number): string {
  return `${formatUSD(toUSD(krw))} (${formatKRW(krw)})`;
}

/**
 * USD만 표시 (토글 USD 모드)
 */
export function formatUSDFromKRW(krw: number): string {
  return formatUSD(toUSD(krw));
}
