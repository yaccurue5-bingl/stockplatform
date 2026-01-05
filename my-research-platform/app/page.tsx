import Image from "next/image";
import { supabase } from "../lib/supabase"; //

// 페이지를 열 때마다 새 데이터를 가져오도록 설정
export const revalidate = 0;

export default async function Home() {
  // 1. 지수 데이터와 기업 리스트를 동시에 가져옵니다.
  // 'stock_indices' 테이블이 있다고 가정하며, 없을 경우 에러 방지를 위해 분리 호출합니다.
  const { data: indices } = await supabase
    .from('stock_indices')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(3);

  const { data: companies, error } = await supabase
    .from('companies') //
    .select('*')
    .order('market_cap', { ascending: false }) // 시총 순 정렬
    .limit(50); // 상위 50개만 우선 출력

  if (error) {
    console.error('데이터 로드 실패:', error.message); //
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black p-4 md:p-8">
      {/* --- 상단 3대 지수 섹션 추가 --- */}
      <div className="w-full max-w-4xl grid grid-cols-3 gap-4 mb-8">
        {indices && indices.length > 0 ? (
          indices.map((idx: any) => (
            <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
              <p className="text-xs text-zinc-500 font-medium">{idx.name}</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-white">{idx.price}</p>
              <p className={`text-xs ${idx.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {idx.change > 0 ? '▲' : '▼'} {Math.abs(idx.change_rate)}%
              </p>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center py-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 text-sm">
            지수 데이터를 불러오는 중입니다...
          </div>
        )}
      </div>

      <main className="flex w-full max-w-4xl flex-col items-center gap-8 bg-white p-6 md:p-12 shadow-sm rounded-2xl dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-2">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <h1 className="text-2xl font-bold text-black dark:text-white mt-4">
            실시간 종목 분석 리스트
          </h1>
        </div>

        {/* 2. 기업 목록 렌더링 (컬럼명 수정: corp_name, stock_code) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies && companies.length > 0 ? (
            companies.map((company: any) => (
              <a 
                href={`/stock/${company.stock_code}`} // 상세 페이지 연결
                key={company.stock_code} 
                className="p-4 border border-zinc-200 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {company.corp_name} {/* */}
                    </p>
                    <span className="text-sm text-zinc-500">{company.stock_code}</span> {/* */}
                  </div>
                  {company.market_cap > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">시가총액</p>
                      <p className="text-sm font-semibold text-blue-600">
                        {Math.floor(company.market_cap / 100000000).toLocaleString()}억
                      </p>
                    </div>
                  )}
                </div>
              </a>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-zinc-500">
              {error ? "에러가 발생했습니다." : "오늘 17:30분 기초 데이터 수집 후 리스트가 표시됩니다."}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}