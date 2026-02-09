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

interface SearchDropdownProps {
  onSelectStock?: (stockCode: string) => void;
  isSuperUser?: boolean;
  placeholder?: string;
}

export default function SearchDropdown({ onSelectStock, isSuperUser, placeholder = "Search company..." }: SearchDropdownProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (query.trim()) {
      setIsOpen(true);
      debounceRef.current = setTimeout(() => {
        search(query);
      }, 300);
    } else {
      setResults([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  // 선택된 항목으로 스크롤
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // 결과 선택
  const handleSelect = (e: React.MouseEvent, result: SearchResult) => {
    e.preventDefault();
    e.stopPropagation();

    setQuery('');
    setResults([]);
    setIsOpen(false);

    if (onSelectStock) {
      onSelectStock(result.stock_code);
    } else if (isSuperUser) {
      router.push(`/stock/${result.stock_code}`);
    }
  };

  // 키보드로 선택
  const handleKeyboardSelect = (result: SearchResult) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);

    if (onSelectStock) {
      onSelectStock(result.stock_code);
    } else if (isSuperUser) {
      router.push(`/stock/${result.stock_code}`);
    }
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleKeyboardSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 검색 입력 */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 512 512">
          <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-600 placeholder-gray-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && (query.trim() || results.length > 0) && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
        >
          {results.length === 0 && query && !loading ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              No results for &quot;{query}&quot;
            </div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((result, index) => (
                <div
                  key={result.stock_code}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  onClick={(e) => handleSelect(e, result)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-blue-600/20' : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">
                        {result.corp_name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{result.corp_name}</div>
                        {result.corp_name_en && (
                          <div className="text-xs text-gray-400">{result.corp_name_en}</div>
                        )}
                        <div className="text-xs text-gray-500">{result.stock_code}</div>
                      </div>
                    </div>
                    {result.latest_disclosure && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        result.latest_disclosure.importance === 'HIGH'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {result.latest_disclosure.importance}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              Searching...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
