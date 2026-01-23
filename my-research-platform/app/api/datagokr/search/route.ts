/**
 * API Route: /api/datagokr/search
 *
 * 통합 검색 API - 종목정보와 기업정보를 한번에 조회
 *
 * Query Parameters:
 * - q: 검색어 (종목명 또는 기업명) - required
 * - basDt: 기준일자 (YYYYMMDD) - optional, defaults to yesterday
 *
 * Examples:
 * - GET /api/datagokr/search?q=삼성전자
 * - GET /api/datagokr/search?q=현대차&basDt=20240115
 *
 * Response:
 * {
 *   success: true,
 *   query: "삼성전자",
 *   basDt: "20240115",
 *   stock: { ... },          // KRX 종목정보
 *   outline: [ ... ],         // 기업개요
 *   affiliates: [ ... ],      // 계열회사
 *   subsidiaries: [ ... ]     // 종속기업
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchStockWithCompanyInfo,
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
    const query = searchParams.get('q');
    const basDt = searchParams.get('basDt') || getYesterdayYYYYMMDD();

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Search API called with query:`, { query, basDt });

    const result = await searchStockWithCompanyInfo(serviceKey, query, basDt);

    if (!result) {
      return NextResponse.json({
        success: true,
        query,
        basDt,
        found: false,
        message: '검색 결과가 없습니다.',
      });
    }

    return NextResponse.json({
      success: true,
      query,
      basDt,
      found: true,
      stock: result.stock,
      outline: result.outline,
      affiliates: result.affiliates,
      subsidiaries: result.subsidiaries,
    });
  } catch (error) {
    console.error('❌ Error in search API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
