import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 (서버 전용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron job 인증 검증
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET_TOKEN;

  if (!cronSecret) {
    console.error('❌ CRON_SECRET_TOKEN is not set');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Missing or invalid authorization header');
    return false;
  }

  const token = authHeader.split(' ')[1];
  return token === cronSecret;
}

export async function GET(req: NextRequest) {
  // Cron job 인증 확인
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('🔄 KRX data collection started...');

  try {
    // 시장 지수 수집
    await collectMarketIndices();

    // 주식 데이터 수집
    await collectStockData();

    console.log('✅ KRX data collection completed');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'KRX data collected successfully',
    });
  } catch (error) {
    console.error('❌ KRX data collection failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// 시장 지수 수집
async function collectMarketIndices() {
  console.log('📊 Collecting market indices...');

  // 실제 구현에서는 KRX API 또는 금융 데이터 API를 호출
  // 여기서는 예제 데이터 구조를 보여줍니다
  const indices = [
    {
      symbol: 'KOSPI',
      name: 'KOSPI',
      price: 2500.0, // 실제로는 API에서 가져옴
      change_value: 10.5,
      change_rate: 0.42,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: 'KOSDAQ',
      name: 'KOSDAQ',
      price: 850.0,
      change_value: -5.2,
      change_rate: -0.61,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: 'KRX100',
      name: 'KRX 100',
      price: 6200.0,
      change_value: 15.0,
      change_rate: 0.24,
      updated_at: new Date().toISOString(),
    },
  ];

  // TODO: 실제 KRX API 호출 구현
  // 예시: const response = await fetch('https://api.krx.co.kr/...');

  for (const index of indices) {
    const { error } = await supabase
      .from('market_indices')
      .upsert(index, { onConflict: 'symbol' });

    if (error) {
      console.error(`❌ Failed to update ${index.symbol}:`, error);
    } else {
      console.log(`✅ Updated ${index.symbol}: ${index.price} (${index.change_rate > 0 ? '+' : ''}${index.change_rate}%)`);
    }
  }
}

// 주식 데이터 수집
async function collectStockData() {
  console.log('📈 Collecting stock data...');

  // companies 테이블에서 모니터링할 종목 목록 가져오기
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('stock_code, corp_name')
    .limit(100); // 한 번에 100개씩 처리

  if (fetchError) {
    console.error('❌ Failed to fetch companies:', fetchError);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log('ℹ️ No companies to monitor');
    return;
  }

  console.log(`📋 Monitoring ${companies.length} companies`);

  // 각 종목의 데이터 수집
  for (const company of companies) {
    try {
      // TODO: 실제 주가 데이터 API 호출
      // 예시: const stockData = await fetchStockPrice(company.stock_code);

      // 예제 데이터 (실제로는 API에서 가져와야 함)
      const stockData = {
        stock_code: company.stock_code,
        corp_name: company.corp_name,
        open_price: Math.floor(Math.random() * 100000) + 10000,
        close_price: Math.floor(Math.random() * 100000) + 10000,
        high_price: Math.floor(Math.random() * 100000) + 10000,
        low_price: Math.floor(Math.random() * 100000) + 10000,
        volume: Math.floor(Math.random() * 10000000),
        trade_value: Math.floor(Math.random() * 1000000000),
        market_cap: Math.floor(Math.random() * 10000000000),
        listed_shares: Math.floor(Math.random() * 100000000),
        market_type: company.stock_code.startsWith('A') ? 'KOSPI' : 'KOSDAQ',
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('companies')
        .update(stockData)
        .eq('stock_code', company.stock_code);

      if (updateError) {
        console.error(`❌ Failed to update ${company.stock_code}:`, updateError);
      }
    } catch (error) {
      console.error(`❌ Error processing ${company.stock_code}:`, error);
    }
  }

  console.log(`✅ Stock data collection completed for ${companies.length} companies`);
}

// POST 메서드도 지원 (수동 트리거용)
export async function POST(req: NextRequest) {
  return GET(req);
}
