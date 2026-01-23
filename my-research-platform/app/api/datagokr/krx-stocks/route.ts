/**
 * API Route: /api/datagokr/krx-stocks
 *
 * KRX 상장종목정보 조회 API
 *
 * Query Parameters:
 * - basDt: 기준일자 (YYYYMMDD) - optional, defaults to yesterday
 * - likeItmsNm: 종목명 검색 - optional
 * - likeSrtnCd: 종목코드 검색 - optional
 * - numOfRows: 조회 건수 - optional, default 100
 * - pageNo: 페이지 번호 - optional, default 1
 * - all: 'true'로 설정 시 모든 종목 조회 (pagination 자동 처리)
 *
 * Examples:
 * - GET /api/datagokr/krx-stocks?basDt=20240115
 * - GET /api/datagokr/krx-stocks?likeItmsNm=삼성
 * - GET /api/datagokr/krx-stocks?all=true
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchKrxListedStocks,
  fetchAllKrxStocks,
  getYesterdayYYYYMMDD,
} from '@/lib/api/datagokr';

export async function GET(request: NextRequest) {
  try {
    const serviceKey = process.env.PUBLIC_DATA_API_KEY;

    if (!serviceKey) {
      return NextResponse.json(
        { error: 'PUBLIC_DATA_API_KEY not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const basDt = searchParams.get('basDt') || getYesterdayYYYYMMDD();
    const likeItmsNm = searchParams.get('likeItmsNm') || undefined;
    const likeSrtnCd = searchParams.get('likeSrtnCd') || undefined;
    const numOfRows = parseInt(searchParams.get('numOfRows') || '100');
    const pageNo = parseInt(searchParams.get('pageNo') || '1');
    const fetchAll = searchParams.get('all') === 'true';

    console.log(`📊 KRX Stocks API called with params:`, {
      basDt,
      likeItmsNm,
      likeSrtnCd,
      numOfRows,
      pageNo,
      fetchAll,
    });

    let stocks;

    if (fetchAll) {
      // 모든 종목 조회 (자동 pagination)
      stocks = await fetchAllKrxStocks(serviceKey, basDt);
    } else {
      // 일반 조회
      stocks = await fetchKrxListedStocks({
        serviceKey,
        basDt,
        likeItmsNm,
        likeSrtnCd,
        numOfRows,
        pageNo,
        resultType: 'json',
      });
    }

    return NextResponse.json({
      success: true,
      count: stocks.length,
      basDt,
      data: stocks,
    });
  } catch (error) {
    console.error('❌ Error fetching KRX stocks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
