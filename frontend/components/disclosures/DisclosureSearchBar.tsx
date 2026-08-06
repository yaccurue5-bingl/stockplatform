'use client';

/**
 * DisclosureSearchBar
 * ====================
 * /disclosures/[id] 상단 검색창. /disclosures(목록+패널) 페이지의 SearchDropdown과
 * 동일한 컴포넌트/동일한 /api/search를 그대로 재사용 — 둘 다 결국 "종목별로 모인
 * 공시 데이터"를 다루는 화면이라 검색 UX를 다르게 둘 이유가 없다.
 *
 * 여기서는 자체 목록 상태가 없는 단일 공시 페이지라, 검색 결과 선택 시
 * 종목의 전체 공시 목록(/disclosures?stock=X)으로 이동한다.
 */

import { useRouter } from 'next/navigation';
import SearchDropdown from '@/components/SearchDropdown';

export default function DisclosureSearchBar() {
  const router = useRouter();

  return (
    <SearchDropdown
      onSelectStock={(stockCode, result) => {
        // 여기(High-Signal Events 개별 페이지)에서 검색했으면 같은 스타일의
        // 개별 페이지로 이동 — /disclosures?stock= (목록+패널 UI)로 튀지 않게.
        const targetId = result.latest_disclosure?.id;
        router.push(targetId ? `/disclosures/${targetId}` : `/disclosures?stock=${stockCode}`);
      }}
      onSearch={(query) => router.push(`/disclosures?search=${encodeURIComponent(query)}`)}
      placeholder="Search company..."
    />
  );
}
