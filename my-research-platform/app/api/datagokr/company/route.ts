/**
 * API Route: /api/datagokr/company
 *
 * 기업기본정보 조회 API (V2)
 *
 * Query Parameters:
 * - type: 조회 유형 (outline|affiliate|subsidiary) - required
 * - basDt: 기준일자 (YYYYMMDD) - optional, defaults to yesterday
 * - likeCorpNm: 법인명 검색 - optional
 * - crno: 법인등록번호 - optional
 * - corpNm: 법인명 정확 일치 - optional
 * - numOfRows: 조회 건수 - optional, default 100
 * - pageNo: 페이지 번호 - optional, default 1
 *
 * Examples:
 * - GET /api/datagokr/company?type=outline&likeCorpNm=삼성전자
 * - GET /api/datagokr/company?type=affiliate&crno=1101110012345
 * - GET /api/datagokr/company?type=subsidiary&likeCorpNm=현대
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCorpOutline,
  fetchCompanyAffiliates,
  fetchConsSubsCompanies,
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
    const type = searchParams.get('type');
    const basDt = searchParams.get('basDt') || getYesterdayYYYYMMDD();
    const likeCorpNm = searchParams.get('likeCorpNm') || undefined;
    const crno = searchParams.get('crno') || undefined;
    const corpNm = searchParams.get('corpNm') || undefined;
    const numOfRows = parseInt(searchParams.get('numOfRows') || '100');
    const pageNo = parseInt(searchParams.get('pageNo') || '1');

    if (!type) {
      return NextResponse.json(
        { error: 'type parameter is required (outline|affiliate|subsidiary)' },
        { status: 400 }
      );
    }

    console.log(`🏢 Company API called with params:`, {
      type,
      basDt,
      likeCorpNm,
      crno,
      corpNm,
      numOfRows,
      pageNo,
    });

    const params = {
      serviceKey,
      basDt,
      likeCorpNm,
      crno,
      corpNm,
      numOfRows,
      pageNo,
      resultType: 'json' as const,
    };

    let data;
    let dataType;

    switch (type) {
      case 'outline':
        data = await fetchCorpOutline(params);
        dataType = '기업개요';
        break;

      case 'affiliate':
        data = await fetchCompanyAffiliates(params);
        dataType = '계열회사';
        break;

      case 'subsidiary':
        data = await fetchConsSubsCompanies(params);
        dataType = '종속기업';
        break;

      default:
        return NextResponse.json(
          {
            error: `Invalid type: ${type}. Must be one of: outline, affiliate, subsidiary`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type: dataType,
      count: data.length,
      basDt,
      data,
    });
  } catch (error) {
    console.error('❌ Error fetching company info:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
