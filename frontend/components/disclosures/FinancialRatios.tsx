'use client';

import { useEffect, useState } from 'react';

interface FinancialsData {
  fiscal_year: number;
  is_financial_sector: boolean;
  revenue_yoy: number | null;
  op_profit_yoy: number | null;
  profit_yoy: number | null;
}

interface RatioRowProps {
  label: string;
  value: number | null;
}

function RatioRow({ label, value }: RatioRowProps) {
  if (value === null) return null;

  const positive  = value >= 0;
  const color     = positive ? 'text-emerald-400' : 'text-red-400';
  const barColor  = positive ? 'bg-emerald-500' : 'bg-red-500';
  const tag       = positive ? 'Growth' : 'Decline';
  // 바 너비: ±50% 이상이면 100%, 비례 계산
  const barWidth  = Math.min(Math.abs(value) / 50 * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${color}`}>{tag}</span>
          <span className={`font-bold text-sm ${color}`}>
            {value >= 0 ? '+' : ''}{value.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

export default function FinancialRatios({ stockCode, eventType, alwaysShow = false }: {
  stockCode: string;
  eventType: string | null;
  alwaysShow?: boolean;  // true면 eventType 무관하게 데이터 있을 때 표시
}) {
  const [data, setData]       = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);

  // alwaysShow=true이면 항상 시도, 아니면 EARNINGS 타입만
  const showSection = alwaysShow || eventType === 'EARNINGS';

  useEffect(() => {
    if (!showSection || !stockCode) { setLoading(false); return; }

    fetch(`/api/financials/${stockCode}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stockCode, showSection]);

  if (!showSection || loading || !data) return null;

  // 모든 YoY 값이 null이면 섹션 자체 숨김
  const hasAnyValue =
    data.revenue_yoy !== null ||
    data.op_profit_yoy !== null ||
    data.profit_yoy !== null;

  if (!hasAnyValue) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
          Financial Ratios (YoY)
        </p>
        <span className="text-xs text-gray-600">FY{data.fiscal_year}</span>
      </div>

      <div className="space-y-4">
        {/* 일반기업만: Revenue / Operating Profit */}
        {!data.is_financial_sector && (
          <>
            <RatioRow label="Revenue"          value={data.revenue_yoy} />
            <RatioRow label="Operating Profit" value={data.op_profit_yoy} />
          </>
        )}
        {/* 모든 기업 공통: Net Profit */}
        <RatioRow label="Net Profit" value={data.profit_yoy} />
      </div>

      {data.is_financial_sector && (
        <p className="text-xs text-gray-600">
          * Financial sector — Revenue & Operating Profit not comparable
        </p>
      )}
    </div>
  );
}
