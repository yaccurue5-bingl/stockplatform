import { supabase } from '../../../lib/supabase';
import StockSentiment from '../../../components/StockSentiment';
import { Metadata } from 'next';

// 1. 기존 타입에 새로운 컬럼(sentiment_score, ai_summary)을 강제로 확장 정의합니다.
interface ExtendedInsight {
  id: string;
  corp_name: string;
  stock_code: string;
  report_nm: string;
  ai_summary: string | null;
  sonnet_summary: string | null;
  sonnet_detailed_analysis: string | null;
  sentiment: string;
  sentiment_score: number;
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

  // ✅ DB에서 최신 공시 데이터 가져오기
  const [insightRes, companyRes] = await Promise.all([
    supabase
      .from('disclosure_insights')
      .select('id, corp_name, stock_code, report_nm, ai_summary, sonnet_summary, sonnet_detailed_analysis, sentiment, sentiment_score, created_at, rcept_no')
      .eq('stock_code', code)
      .eq('analysis_status', 'completed') // 분석 완료된 것만
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(), // ✅ single() 대신 maybeSingle() 사용 (0개여도 에러 안남)
    supabase.from('companies').select('*').eq('code', code).maybeSingle()
  ]);

  const insight = insightRes.data as ExtendedInsight | null;
  const company = companyRes.data as Company | null;

  if (!insight) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-gray-800">데이터를 찾을 수 없습니다.</h1>
        <p className="text-gray-600 mt-4">
          종목코드 {code}에 대한 공시 분석 데이터가 없습니다.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          공시가 등록되면 AI 분석이 자동으로 진행됩니다.
        </p>
      </div>
    );
  }

  // ✅ Sonnet 분석이 있으면 우선 사용, 없으면 Groq 분석 사용
  const displaySummary = insight.sonnet_summary || insight.sonnet_detailed_analysis || insight.ai_summary || "분석 데이터를 생성 중입니다.";

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
          <StockSentiment
            sentiment={insight.sentiment}
            sentiment_score={insight.sentiment_score}
            ai_summary={displaySummary}
          />
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-bold text-gray-700 mb-4 pb-2 border-b">
            최신 공시: {insight.report_nm}
          </h3>
          <div className="prose max-w-none text-gray-800 leading-relaxed bg-slate-50 p-6 rounded-xl">
            <p className="whitespace-pre-wrap">{displaySummary}</p>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            분석 일시: {new Date(insight.created_at).toLocaleString('ko-KR')}
          </p>
        </div>
      </section>
    </div>
  );
}