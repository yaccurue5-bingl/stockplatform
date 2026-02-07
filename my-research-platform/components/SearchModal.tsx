'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  stock_code: string;
  corp_code: string;
  corp_name: string;
  corp_name_en: string | null;
  latest_disclosure: {
    id: string;
    report_nm: string;
    sentiment: string;
    importance: string;
    analyzed_at: string;
  } | null;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock?: (stockCode: string) => void;
  isSuperUser?: boolean;
}

export default function SearchModal({ isOpen, onClose, onSelectStock, isSuperUser }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 모달 열릴 때 입력창 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // 검색 실행 (디바운스 적용)
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 입력 변화 시 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  // 결과 선택
  const handleSelect = (result: SearchResult) => {
    if (onSelectStock) {
      onSelectStock(result.stock_code);
    } else if (isSuperUser) {
      router.push(`/stock/${result.stock_code}`);
    }
    onClose();
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 검색 입력 */}
        <div className="flex items-center px-4 border-b border-gray-800">
          <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 512 512">
            <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by company name, English name, or stock code..."
            className="flex-1 bg-transparent py-4 text-white text-lg focus:outline-none placeholder-gray-500"
          />
          {loading && (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* 검색 결과 */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query && !loading ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <div
                  key={result.stock_code}
                  onClick={() => handleSelect(result)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-blue-600/20' : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                        {result.corp_name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{result.corp_name}</div>
                        {result.corp_name_en && (
                          <div className="text-sm text-gray-400">{result.corp_name_en}</div>
                        )}
                        <div className="text-xs text-gray-500">{result.stock_code}</div>
                      </div>
                    </div>
                    {result.latest_disclosure && (
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded ${
                          result.latest_disclosure.importance === 'HIGH'
                            ? 'bg-red-900/30 text-red-400'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {result.latest_disclosure.importance}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500 flex items-center gap-4">
          <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded">Enter</kbd> Select</span>
          <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
