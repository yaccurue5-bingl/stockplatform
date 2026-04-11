/**
 * generateTicker
 * ==============
 * 영문 회사명에서 3자리 영문 티커를 생성하는 유틸리티.
 *
 * 우선순위:
 *   1. 공식 영문 약칭 (수동 오버라이드 테이블)
 *   2. 영문명의 대문자만 추출 → 3글자 이상이면 앞 3글자
 *   3. 첫 번째 단어의 앞 3글자 (대문자화)
 */

// ── 수동 오버라이드 (Priority 1) ────────────────────────────────────────────
// 공식 약칭이 있는 주요 종목을 여기서 관리
const MANUAL_TICKERS: Record<string, string> = {
  'samsung electronics':  'SEC',
  'samsung':              'SEC',
  'sk networks':          'SKN',
  'sk hynix':             'SKH',
  'sk telecom':           'SKT',
  'lg electronics':       'LGE',
  'lg chem':              'LGC',
  'hyundai motor':        'HMC',
  'hyundai':              'HMC',
  'kia':                  'KIA',
  'posco':                'PKX',
  'kakao':                'KKO',
  'naver':                'NVR',
  'celltrion':            'CTL',
  'kb financial':         'KBF',
  'shinhan financial':    'SHF',
  'hana financial':       'HAF',
  'woori financial':      'WRF',
  'jeju air':             'JJA',
  'jejuair':              'JJA',
  'korean air':           'KAL',
  'asiana airlines':      'AAR',
  'lotte':                'LTT',
  'cj':                   'CJK',
  'hanwha':               'HWA',
  'doosan':               'DSN',
};

// ── 제거할 공통 법인 접미사 ─────────────────────────────────────────────────
const SUFFIX_PATTERN =
  /\s*,?\s*\b(co\.?,?\s*(ltd\.?|inc\.?)|corporation|corp\.?|limited|ltd\.?|incorporated|inc\.?|holdings?|group|partners?|international|global|solutions?|technologies?|tech)\b\.?\s*$/gi;

export function generateTicker(corpNameEn: string | null | undefined): string {
  if (!corpNameEn || !corpNameEn.trim()) return '?';

  // Priority 1: 수동 오버라이드
  const key = corpNameEn.toLowerCase().trim();
  for (const [pattern, ticker] of Object.entries(MANUAL_TICKERS)) {
    if (key === pattern || key.startsWith(pattern + ' ') || key.startsWith(pattern + ',')) {
      return ticker;
    }
  }

  // 접미사 제거
  const cleaned = corpNameEn.replace(SUFFIX_PATTERN, '').trim();

  // Priority 2: 대문자만 추출 (두문자어 스타일)
  const uppers = cleaned.replace(/[^A-Z]/g, '');
  if (uppers.length >= 3) {
    return uppers.slice(0, 3);
  }

  // Priority 3: 첫 번째 단어 앞 3글자
  const firstWord = cleaned.split(/[\s,]+/)[0];
  const padded = (firstWord.toUpperCase() + 'XXX').slice(0, 3);
  return padded;
}
