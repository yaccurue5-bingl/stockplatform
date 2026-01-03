import { supabase } from '@/lib/supabase';
import { DisclosureInsight, Company } from '@/types/database';
import StockSentiment from '@/components/StockSentiment';
import { Metadata } from 'next';

// 1. 동적 메타 태그 설정 (Next.js 15 비동기 params 대응) 
export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ code: string }> 
}): Promise<Metadata> {
  // params를 await로 먼저 받아와야 합니다.
  const { code } = await params;

  const { data } = await supabase
    .from('disclosure_insights')
    .select('corp_name')
    .eq('stock_code', code)
    .single();

  return {
    title: `${data?.corp_name || code} AI 공시 분석 및 기업 정보`,
    description: `${data?.corp_name || '해당 종목'}의 최신 공시 AI 요약과 시가총액, 업종 등 핵심 기업 정보를 확인하세요.`,
  };
}

// 2. 종목 상세 페이지 메인 컴포넌트 (Next.js 15 비동기 params 대응)
export default async function StockPage({ 
  params 
}: { 
  params: Promise<{ code: string }> 
}) {
  // 컴포넌트 내부에서도 params를 await로 처리합니다.
  const { code } = await params;

  // 병렬 데이터 페칭: 공시 분석 정보와 기업 정보를 동시에 가져와 성능을 높임
  const [insightRes, companyRes] = await Promise.all([
    supabase.from('disclosure_insights').select('*').eq('stock_code', code).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('companies').select('*').eq('stock_code', code).single()
  ]);

  const insight: DisclosureInsight = insightRes.data;
  const company: Company = companyRes.data;

  // 데이터가 없을 경우 처리
  if (!insight) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-gray-800">데이터를 찾을 수 없습니다.</h1>
        <p className="mt-2 text-gray-500">해당 종목({code})의 분석 데이터가 아직 생성되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      {/* 기업 기본 정보 섹션: 검색 로봇이 읽기 좋은 텍스트 구조 */}
      <section className="mb-10 border-b pb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-4xl font-extrabold text-gray-900">{insight.corp_name}</h1>
          <span className="text-xl text-gray-500 font-mono">{insight.stock_code}</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-600 mb-1 font-medium">업종</p>
            <p className="text-lg font-bold text-gray-800">{company?.sector || '정보 없음'}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-600 mb-1 font-medium">시가총액</p>
            <p className="text-lg font-bold text-gray-800">
              {company?.market_cap ? `${company.market_cap.toLocaleString()}억` : '정보 없음'}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-600 mb-1 font-medium">영업이익률</p>
            <p className="text-lg font-bold text-gray-800">
              {company?.operating_profit_margin ? `${company.operating_profit_margin}%` : '정보 없음'}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-600 mb-1 font-medium">외인 지분율</p>
            <p className="text-lg font-bold text-gray-800">
              {company?.foreign_ownership ? `${company.foreign_ownership}%` : '정보 없음'}
            </p>
          </div>
        </div>
      </section>

      {/* AI 리서치 리포트 섹션 */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">AI 리서치 리포트</h2>
          <StockSentiment sentiment={insight.sentiment} />
        </div>
        
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-bold text-gray-700 mb-4 pb-2 border-b">
            최신 공시: {insight.report_nm}
          </h3>
          <div className="prose max-w-none text-gray-800 leading-relaxed">
            <p className="whitespace-pre-wrap">{insight.ai_summary}</p>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            분석 일시: {new Date(insight.created_at).toLocaleString('ko-KR')}
          </p>
        </div>
      </section>
    </div>
  );
}
// app/stock/[code]/page.tsx 맨 아래 추가
export async function generateStaticParams() {
  // 테스트용으로 삼성전자(005930) 페이지 하나만 미리 생성하도록 설정
  return [{ code: '005930' }];
}