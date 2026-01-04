import Image from "next/image";
// 1. 아까 확인한 lib/supabase.ts 파일을 불러옵니다. (경로가 다르면 수정하세요)
import { supabase } from "../lib/supabase"; 

// 이 설정을 추가하면 Vercel 캐시를 무시하고 페이지를 열 때마다 새 데이터를 가져옵니다.
export const revalidate = 0;

export default async function Home() {
  // 2. Supabase에서 company 테이블의 모든 데이터를 가져옵니다.
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*');

  if (error) {
    console.error('데이터 로드 실패:', error.message);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 bg-white p-12 shadow-sm rounded-2xl dark:bg-zinc-900">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />

        <h1 className="text-3xl font-bold text-black dark:text-white">
          Company 리스트
        </h1>

        {/* 3. 데이터가 있을 경우 목록을 렌더링합니다. */}
        <div className="w-full space-y-4">
          {companies && companies.length > 0 ? (
            companies.map((company: any) => (
              <div 
                key={company.id} 
                className="p-4 border border-zinc-200 rounded-lg bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  {/* name 대신 실제 테이블의 컬럼명을 사용하세요 (예: company_name 등) */}
                  {company.name || "이름 없음"}
                </p>
                <span className="text-sm text-zinc-500">{company.id}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-zinc-500">
              {error ? "에러가 발생했습니다." : "가져올 데이터가 없습니다. RLS와 테이블 데이터를 확인해주세요."}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <a
            className="rounded-full bg-black px-6 py-2 text-white hover:bg-zinc-800 transition-colors"
            href="https://nextjs.org/docs"
          >
            문서 보기
          </a>
        </div>
      </main>
    </div>
  );
}