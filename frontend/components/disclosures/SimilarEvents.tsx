'use client';

import { useEffect, useState } from 'react';

interface SimilarEvent {
  date: string;
  final_score: number | null;
  future_return_3d: number | null;
  future_return_5d: number | null;
  future_return_20d: number | null;
  mdd_20d: number | null;
  event_type?: string | null;
  report_nm?: string | null;
  report_nm_en?: string | null;
}

interface Props {
  stockCode: string;
  eventType?: string | null;
}

function ReturnBadge({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const pos = value >= 0;
  return (
    <div className="text-center">
      <p className="text-[10px] text-gray-600 mb-0.5">{label}</p>
      <p className={`text-xs font-bold ${pos ? 'text-green-400' : 'text-red-400'}`}>
        {pos ? '+' : ''}{value.toFixed(1)}%
      </p>
    </div>
  );
}

export default function SimilarEvents({ stockCode, eventType }: Props) {
  const [events, setEvents] = useState<SimilarEvent[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stockCode) return;
    const url = eventType
      ? `/api/similar-events?stock=${stockCode}&event_type=${eventType}`
      : `/api/similar-events?stock=${stockCode}`;
    fetch(url)
      .then(r => r.ok ? r.json() : { events: [], fallback: false })
      .then(d => {
        // 신규 형식 { events, fallback } 또는 구형 array 모두 처리
        if (Array.isArray(d)) {
          setEvents(d);
        } else {
          setEvents(Array.isArray(d.events) ? d.events : []);
          setIsFallback(!!d.fallback);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stockCode, eventType]);

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-2/3 mb-3" />
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-800 rounded" />)}
      </div>
    </div>
  );

  if (!events.length) return null;

  // 평균 수익률 계산
  const validReturns = events.filter(e => e.future_return_5d != null);
  const avgReturn5d = validReturns.length
    ? validReturns.reduce((s, e) => s + (e.future_return_5d ?? 0), 0) / validReturns.length
    : null;
  const hitCount = validReturns.filter(e => (e.future_return_5d ?? 0) > 0).length;

  // 제목: fallback이면 "Past Signals" (All), 아니면 "Past DILUTION Signals"
  const title = isFallback
    ? 'Past Signals (All Events)'
    : `Past ${eventType ? `${eventType} ` : ''}Signals`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          {isFallback && eventType && (
            <p className="text-[10px] text-gray-600 mt-0.5">No past {eventType} data — showing all signals</p>
          )}
        </div>
        {avgReturn5d != null && (
          <span className={`text-xs font-bold ${avgReturn5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            avg {avgReturn5d >= 0 ? '+' : ''}{avgReturn5d.toFixed(1)}% (5d)
          </span>
        )}
      </div>

      {/* Hit ratio bar */}
      {validReturns.length >= 2 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Win rate (5d)</span>
            <span className="font-medium text-white">
              {hitCount}/{validReturns.length} ({Math.round(hitCount/validReturns.length*100)}%)
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.round(hitCount/validReturns.length*100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 개별 이벤트 목록 */}
      <div className="space-y-2">
        {events.map((e, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-xs text-gray-500">{e.date}</p>
              <p className="text-xs text-gray-400 truncate">
                {e.report_nm_en || e.report_nm || e.event_type || 'Disclosure'}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ReturnBadge value={e.future_return_5d} label="5d" />
              <ReturnBadge value={e.future_return_20d} label="20d" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-700 mt-2">Past returns do not guarantee future results.</p>
    </div>
  );
}
