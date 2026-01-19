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
const DEFAULT_INDICES: MarketIndicesData = {
  KOSPI: { value: 2645.38, change: 1.24 },
  KOSDAQ: { value: 876.52, change: -0.68 },
  USDKRW: { value: 1332.50, change: 0.15 }
};

// ✅ localStorage에서 캐싱된 값 불러오기
const getInitialIndices = (): MarketIndicesData => {
  if (typeof window === 'undefined') return DEFAULT_INDICES;

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 캐시된 데이터 유효성 검증
      if (parsed.KOSPI && parsed.KOSDAQ && parsed.USDKRW) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load cached indices:', error);
  }

  return DEFAULT_INDICES;
};

export default function MarketIndices() {
  // ✅ 초기값으로 캐시된 값 사용 (없으면 기본값)
  const [indices, setIndices] = useState<MarketIndicesData>(getInitialIndices);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <div className="flex items-center space-x-6">
      <div>
        <div className="text-sm text-blue-200 mb-1">KOSPI</div>
        <div className="text-2xl font-bold">
          {indices.KOSPI.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-sm ${indices.KOSPI.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {indices.KOSPI.change >= 0 ? '+' : ''}{indices.KOSPI.change.toFixed(2)}%
        </div>
      </div>
      <div className="h-12 w-px bg-blue-600"></div>
      <div>
        <div className="text-sm text-blue-200 mb-1">KOSDAQ</div>
        <div className="text-2xl font-bold">
          {indices.KOSDAQ.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-sm ${indices.KOSDAQ.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {indices.KOSDAQ.change >= 0 ? '+' : ''}{indices.KOSDAQ.change.toFixed(2)}%
        </div>
      </div>
      <div className="h-12 w-px bg-blue-600"></div>
      <div>
        <div className="text-sm text-blue-200 mb-1">USD/KRW</div>
        <div className="text-2xl font-bold">
          {indices.USDKRW.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-sm ${indices.USDKRW.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {indices.USDKRW.change >= 0 ? '+' : ''}{indices.USDKRW.change.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
