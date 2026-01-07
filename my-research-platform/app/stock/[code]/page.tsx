import { supabase } from '../../../lib/supabase';
import StockSentiment from '../../../components/StockSentiment';
import { Metadata } from 'next';

// 1. 기존 타입에 새로운 컬럼(sentiment_score, ai_summary)을 강제로 확장 정의합니다.
interface ExtendedInsight {
  id: number;
  corp_name: string;
  stock_code: string;
  report_nm: string;
  ai_summary: string;      // 추가된 컬럼
  sentiment: string;
  sentiment_score: number; // 추가된 컬럼 (빨간줄 해결 핵심)
  created_at: string;
  rcept_no: string;
}

interface Company {
  sector?: string;
  market_cap?: number;
  operating_profit_margin?: number;
  foreign_ownership?: number;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { data } = await supabase.from('disclosure_insights').select('corp_name').eq('stock_code', code).single();
  return { title: `${data?.corp_name || code} AI 공시 분석` };
}

export default async function StockPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [insightRes, companyRes] = await Promise.all([
    supabase.from('disclosure_insights').select('*').eq('stock_code', code).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('companies').select('*').eq('stock_code', code).single()
  ]);

  // 타입을 ExtendedInsight로 캐스팅하여 하단 StockSentiment 호출 시 에러를 방지합니다.
  const insight = insightRes.data as ExtendedInsight;
  const company = companyRes.data as Company;

  if (!insight) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-gray-800">데이터를 찾을 수 없습니다.</h1>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
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
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">AI 리서치 리포트</h2>
          {/* 이제 insight.sentiment_score에 빨간줄이 생기지 않습니다. */}
          <StockSentiment 
            sentiment={insight.sentiment} 
            sentiment_score={insight.sentiment_score} 
            ai_summary={insight.ai_summary} 
          />
        </div>
        
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-bold text-gray-700 mb-4 pb-2 border-b">
            최신 공시: {insight.report_nm}
          </h3>
          <div className="prose max-w-none text-gray-800 leading-relaxed bg-slate-50 p-6 rounded-xl">
            <p className="whitespace-pre-wrap">{insight.ai_summary || "분석 데이터를 생성 중입니다."}</p>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            분석 일시: {new Date(insight.created_at).toLocaleString('ko-KR')}
          </p>
        </div>
      </section>
    </div>
  );
}