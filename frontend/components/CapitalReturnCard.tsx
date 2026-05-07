/**
 * CapitalReturnCard — BUYBACK 이벤트 보조 카드 (공유 컴포넌트)
 *
 * 사용처:
 *  - /signal/[id]      : publicKeyNums = keyNums.slice(0, 2) (잠금 우회 없음)
 *  - /disclosures/[id] : publicKeyNums = 전체 (로그인 시), [] (비로그인)
 */

export type BuybackSubtype = 'CANCELLATION' | 'BUYBACK' | 'DISPOSAL'

/** headline + key_numbers 전체 텍스트로 자사주 이벤트 세부 분류 */
export function classifyBuybackSubtype(
  headline: string | null,
  keyNums: string[],
): BuybackSubtype {
  const combined = [headline ?? '', ...keyNums].join(' ').toLowerCase()
  if (/cancel|소각/.test(combined)) return 'CANCELLATION'
  if (/dispos|처분/.test(combined))  return 'DISPOSAL'
  return 'BUYBACK'
}

/** key_numbers 배열에서 패턴 매칭 → "Label: Value" 에서 Value만 반환 */
export function findMetricValue(lines: string[], patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const line = lines.find(l => pat.test(l))
    if (line) {
      const stripped  = line.replace(/^[•\-]\s*/, '').trim()
      const colonIdx  = stripped.indexOf(':')
      return colonIdx !== -1 ? stripped.slice(colonIdx + 1).trim() : stripped
    }
  }
  return null
}

export const CR_CONFIG: Record<
  BuybackSubtype,
  {
    label: string
    description: string
    impact: string
    border: string
    bg: string
    badge: string
    impactStyle: string
    amountPats: RegExp[]
    sharesPats: RegExp[]
  }
> = {
  CANCELLATION: {
    label:       'Treasury Cancellation',
    description: 'Permanent reduction in total share supply',
    impact:      'Bullish',
    border:      'border-emerald-500/25',
    bg:          'bg-emerald-500/5',
    badge:       'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    impactStyle: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    amountPats:  [/cancellation amount/i, /expected cancellation/i, /amount/i],
    sharesPats:  [/shares? to be cancell/i, /number of shares/i, /shares? cancel/i],
  },
  BUYBACK: {
    label:       'Share Buyback',
    description: 'Open market share repurchase',
    impact:      'Positive',
    border:      'border-[#00D4A6]/25',
    bg:          'bg-[#00D4A6]/5',
    badge:       'text-[#00D4A6] bg-[#00D4A6]/10 border-[#00D4A6]/30',
    impactStyle: 'text-[#00D4A6] bg-[#00D4A6]/10 border-[#00D4A6]/30',
    amountPats:  [/acquisition amount/i, /trust contract amount/i, /total acquisition cost/i, /amount/i],
    sharesPats:  [/total shares acqui/i, /shares? (to be )?acqui/i, /number of shares/i],
  },
  DISPOSAL: {
    label:       'Treasury Disposal',
    description: 'Treasury shares released — supply increase risk',
    impact:      'Caution',
    border:      'border-yellow-500/25',
    bg:          'bg-yellow-500/5',
    badge:       'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    impactStyle: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    amountPats:  [/disposal amount/i, /amount/i],
    sharesPats:  [/shares? (to be )?dispos/i, /total shares dispos/i, /number of shares/i],
  },
}

/**
 * Capital Return 보조 카드
 *
 * @param subtype       - 분류 결과 (CANCELLATION | BUYBACK | DISPOSAL)
 * @param publicKeyNums - 수치 표시에 사용할 key_numbers 라인 배열
 *                        signal 페이지: 상위 2개만 (잠금 우회 없음)
 *                        disclosures 페이지: 로그인 시 전체, 비로그인 시 []
 */
export default function CapitalReturnCard({
  subtype,
  publicKeyNums,
}: {
  subtype: BuybackSubtype
  publicKeyNums: string[]
}) {
  const cfg    = CR_CONFIG[subtype]
  const amount = findMetricValue(publicKeyNums, cfg.amountPats)
  const shares = findMetricValue(publicKeyNums, cfg.sharesPats)

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5`}>
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-4">
        Capital Return
      </p>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* 왼쪽: 분류 배지 + 설명 + 수치 */}
        <div className="space-y-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          <p className="text-xs text-gray-500">{cfg.description}</p>

          {(amount || shares) && (
            <dl className="mt-2 space-y-1.5">
              {amount && (
                <div className="flex gap-2 text-xs">
                  <dt className="text-gray-500 w-14 shrink-0">Amount</dt>
                  <dd className="text-gray-200 font-mono">{amount}</dd>
                </div>
              )}
              {shares && (
                <div className="flex gap-2 text-xs">
                  <dt className="text-gray-500 w-14 shrink-0">Shares</dt>
                  <dd className="text-gray-200 font-mono">{shares}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* 오른쪽: Shareholder Impact 배지 */}
        <div className="shrink-0 text-center sm:text-right">
          <p className="text-xs text-gray-500 mb-1.5">Shareholder Impact</p>
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-bold ${cfg.impactStyle}`}
          >
            {cfg.impact}
          </span>
        </div>
      </div>
    </div>
  )
}
