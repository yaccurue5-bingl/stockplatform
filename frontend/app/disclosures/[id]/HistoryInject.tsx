'use client';

import { useEffect } from 'react';

/**
 * history stack에 /disclosures를 조용히 주입합니다.
 *
 * 효과:
 *   Before: [/, /disclosures/[id]]   ← current
 *   After:  [/, /disclosures, /disclosures/[id]]  ← current
 *
 * 결과: 뒤로가기 → /disclosures (all list) → 뒤로가기 → / (landing)
 * URL이나 화면은 변경되지 않습니다.
 */
export default function HistoryInject() {
  useEffect(() => {
    const current = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', '/disclosures');
    window.history.pushState(null, '', current);
  }, []);
  return null;
}
