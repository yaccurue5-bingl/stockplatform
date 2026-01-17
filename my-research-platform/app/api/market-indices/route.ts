import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 최신 지수 데이터 가져오기 (코스피, 코스닥, USD/KRW)
    const { data: indices, error } = await supabase
      .from('market_indices')
      .select('*')
      .in('index_code', ['KOSPI', 'KOSDAQ', 'USDKRW'])
      .order('recorded_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error fetching market indices:', error);
      // 에러 발생 시 기본값 반환
      return NextResponse.json({
        KOSPI: { value: 2645.38, change: 1.24 },
        KOSDAQ: { value: 876.52, change: -0.68 },
        USDKRW: { value: 1332.50, change: 0.15 }
      });
    }

    // 데이터를 index_code별로 정리
    const result: any = {
      KOSPI: { value: 2645.38, change: 1.24 },
      KOSDAQ: { value: 876.52, change: -0.68 },
      USDKRW: { value: 1332.50, change: 0.15 }
    };

    if (indices && indices.length > 0) {
      indices.forEach((index: any) => {
        result[index.index_code] = {
          value: index.current_value,
          change: index.change_percent
        };
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Unexpected error:', error);
    // 에러 발생 시 기본값 반환
    return NextResponse.json({
      KOSPI: { value: 2645.38, change: 1.24 },
      KOSDAQ: { value: 876.52, change: -0.68 },
      USDKRW: { value: 1332.50, change: 0.15 }
    });
  }
}
