import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 최신 지수 데이터 가져오기 (코스피, 코스닥, USD/KRW)
    // scripts/update_indices.py와 동일한 필드명 사용: symbol, price, change_rate
    const { data: indices, error } = await supabase
      .from('market_indices')
      .select('*')
      .in('symbol', ['KOSPI', 'KOSDAQ', 'USDKRW']);

    if (error) {
      console.error('Error fetching market indices:', error);
      return NextResponse.json({ KOSPI: null, KOSDAQ: null, USDKRW: null }, { status: 503 });
    }

    // 데이터를 symbol별로 정리
    const result: Record<string, { value: number; change: number } | null> = {
      KOSPI: null,
      KOSDAQ: null,
      USDKRW: null,
    };

    if (indices && indices.length > 0) {
      indices.forEach((index: any) => {
        // price는 "2,645.38" 형식의 문자열이므로 파싱 필요
        const priceValue = parseFloat(String(index.price).replace(/,/g, ''));
        result[index.symbol] = {
          value: priceValue,
          change: index.change_rate,
        };
      });
    }

    // 데이터가 하나도 없으면 503 (캐시 유지 유도)
    const hasData = Object.values(result).some((v) => v !== null);
    if (!hasData) {
      return NextResponse.json({ KOSPI: null, KOSDAQ: null, USDKRW: null }, { status: 503 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ KOSPI: null, KOSDAQ: null, USDKRW: null }, { status: 503 });
  }
}
