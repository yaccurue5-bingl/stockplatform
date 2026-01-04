import Image from "next/image";
import { supabase } from "../lib/supabase"; //

export const revalidate = 0;

export default async function Home() {
  // 1. 데이터가 있는 'disclosure_insights' 테이블에서 가져오기
  const { data: insights, error } = await supabase
    .from('disclosure_insights')
    .select('*')
    .limit(10); // 테스트를 위해 10개만 가져옴

  if (error) {
    console.error('데이터 로드 실패:', error.message);
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-4xl bg-white p-8 rounded-xl shadow dark:bg-zinc-900">
        <h1 className="text-2xl font-bold mb-6">Disclosure Insights 데이터 확인</h1>

        {insights && insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((item: any, index: number) => (
              <div key={index} className="p-4 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                {/* 데이터의 구조를 파악하기 위해 전체 내용을 JSON으로 출력해봅니다 */}
                <pre className="text-xs overflow-auto text-zinc-600 dark:text-zinc-300">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-zinc-500">
            {error ? `에러 발생: ${error.message}` : "데이터가 없습니다. RLS 설정을 확인해주세요."}
          </div>
        )}
      </main>
    </div>
  );
}