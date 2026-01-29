'use client';

import { useEffect, useState } from 'react';

interface IndexData {
  value: number;
  change: number;
}

interface MarketIndicesData {
  KOSPI: IndexData;
  KOSDAQ: IndexData;
  USDKRW: IndexData;
}

const STORAGE_KEY = 'market-indices-cache';

export default function MarketIndices() {
  // ✅ 초기값은 무조건 null (서버/클라이언트 동일하게 시작)
  const [indices, setIndices] = useState<MarketIndicesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ 클라이언트에서 mount된 후 localStorage 캐시 로드
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.KOSPI && parsed.KOSDAQ && parsed.USDKRW) {
          setIndices(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load cached indices:', error);
    }

    // 초기 로드
    fetchIndices();

    // 5분마다 업데이트
    const interval = setInterval(fetchIndices, 300000);

    return () => clearInterval(interval);
  }, []);

  const fetchIndices = async () => {
    try {
      const response = await fetch('/api/market-indices');
      if (response.ok) {
        const data = await response.json();
        setIndices(data);
        setError(null);

        // ✅ localStorage에 캐싱하여 다음 방문 시 사용
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (storageError) {
          console.error('Failed to cache indices:', storageError);
        }
      } else {
        console.error('Failed to fetch market indices:', response.status);
        // 에러 발생해도 현재값(캐시 또는 기본값) 유지
      }
    } catch (error) {
      console.error('Failed to fetch market indices:', error);
      setError('Unable to load market data');
      // 에러 발생해도 현재값(캐시 또는 기본값) 유지
    }
  };

  // ✅ 로딩 중일 때 skeleton 표시 (깜빡임 방지)
  if (!indices) {
    return (
      <div className="flex items-center gap-4 md:gap-6 min-w-max">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            {i > 1 && <div className="h-12 w-px bg-blue-600 flex-shrink-0"></div>}
            <div className="flex-shrink-0 animate-pulse">
              <div className="h-4 w-16 bg-blue-800 rounded mb-2"></div>
              <div className="h-6 w-24 bg-blue-700 rounded mb-1"></div>
              <div className="h-4 w-16 bg-blue-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 md:gap-6 min-w-max">
      <div className="flex-shrink-0">
        <div className="text-xs md:text-sm text-blue-200 mb-1">KOSPI</div>
        <div className="text-xl md:text-2xl font-bold">
          {indices.KOSPI.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-xs md:text-sm ${indices.KOSPI.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {indices.KOSPI.change >= 0 ? '+' : ''}{indices.KOSPI.change.toFixed(2)}%
        </div>
      </div>
      <div className="h-12 w-px bg-blue-600 flex-shrink-0"></div>
      <div className="flex-shrink-0">
        <div className="text-xs md:text-sm text-blue-200 mb-1">KOSDAQ</div>
        <div className="text-xl md:text-2xl font-bold">
          {indices.KOSDAQ.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-xs md:text-sm ${indices.KOSDAQ.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {indices.KOSDAQ.change >= 0 ? '+' : ''}{indices.KOSDAQ.change.toFixed(2)}%
        </div>
      </div>
      <div className="h-12 w-px bg-blue-600 flex-shrink-0"></div>
      <div className="flex-shrink-0">
        <div className="text-xs md:text-sm text-blue-200 mb-1">USD/KRW</div>
        <div className="text-xl md:text-2xl font-bold">
          {indices.USDKRW.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-xs md:text-sm ${indices.USDKRW.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {indices.USDKRW.change >= 0 ? '+' : ''}{indices.USDKRW.change.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
