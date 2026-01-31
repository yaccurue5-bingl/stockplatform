/**
 * Data.go.kr API 테스트 스크립트
 *
 * 사용법:
 * 1. .env.local에 PUBLIC_DATA_API_KEY 설정
 * 2. npx tsx scripts/test-datagokr.ts
 */

import {
  fetchKrxListedStocks,
  fetchCorpOutline,
  searchStockWithCompanyInfo,
  getYesterdayYYYYMMDD,
} from '../lib/api/datagokr';

async function testDataGoKrAPI() {
  const apiKey = process.env.PUBLIC_DATA_API_KEY;

  if (!apiKey) {
    console.error('❌ PUBLIC_DATA_API_KEY가 설정되지 않았습니다.');
    console.log('📝 .env.local 파일에 다음을 추가하세요:');
    console.log('   PUBLIC_DATA_API_KEY=your_api_key_here');
    process.exit(1);
  }

  console.log('🚀 Data.go.kr API 테스트 시작\n');

  // 테스트 날짜 (어제)
  const testDate = getYesterdayYYYYMMDD();
  console.log(`📅 테스트 날짜: ${testDate}\n`);

  // 테스트 1: KRX 종목 조회 (삼성전자)
  console.log('=== 테스트 1: KRX 종목 조회 (삼성) ===');
  try {
    const stocks = await fetchKrxListedStocks({
      serviceKey: apiKey,
      likeItmsNm: '삼성',
      basDt: testDate,
      numOfRows: 5,
    });

    console.log(`✅ ${stocks.length}개 종목 조회 성공`);
    stocks.forEach((stock, idx) => {
      console.log(`  ${idx + 1}. ${stock.itmsNm} (${stock.srtnCd})`);
      console.log(`     종가: ${stock.clpr}원, 등락률: ${stock.fltRt}%`);
    });
  } catch (error) {
    console.error('❌ KRX 종목 조회 실패:', error);
  }

  console.log('\n');

  // 테스트 2: 기업개요 조회
  console.log('=== 테스트 2: 기업개요 조회 (삼성전자) ===');
  try {
    const companies = await fetchCorpOutline({
      serviceKey: apiKey,
      likeCorpNm: '삼성전자',
      basDt: testDate,
      numOfRows: 1,
    });

    if (companies.length > 0) {
      const company = companies[0];
      console.log('✅ 기업정보 조회 성공');
      console.log(`  법인명: ${company.corpNm}`);
      console.log(`  영문명: ${company.corpEnsnNm}`);
      console.log(`  대표자: ${company.enpRprFnm}`);
      console.log(`  설립일: ${company.enpEstbDt}`);
      console.log(`  홈페이지: ${company.enpHmpgUrl}`);
      console.log(`  전화번호: ${company.enpTlno}`);
    } else {
      console.log('⚠️  조회된 기업 없음');
    }
  } catch (error) {
    console.error('❌ 기업개요 조회 실패:', error);
  }

  console.log('\n');

  // 테스트 3: 통합 검색
  console.log('=== 테스트 3: 통합 검색 (삼성전자) ===');
  try {
    const result = await searchStockWithCompanyInfo(
      apiKey,
      '삼성전자',
      testDate
    );

    if (result) {
      console.log('✅ 통합 검색 성공');
      console.log('\n📊 종목 정보:');
      console.log(`  종목명: ${result.stock.itmsNm}`);
      console.log(`  종목코드: ${result.stock.srtnCd}`);
      console.log(`  종가: ${result.stock.clpr}원`);
      console.log(`  시가총액: ${result.stock.mrktTotAmt}원`);

      console.log('\n🏢 기업 정보:');
      if (result.outline.length > 0) {
        console.log(`  기업개요: ${result.outline.length}건`);
      }
      if (result.affiliates.length > 0) {
        console.log(`  계열회사: ${result.affiliates.length}건`);
      }
      if (result.subsidiaries.length > 0) {
        console.log(`  종속기업: ${result.subsidiaries.length}건`);
      }
    } else {
      console.log('⚠️  검색 결과 없음');
    }
  } catch (error) {
    console.error('❌ 통합 검색 실패:', error);
  }

  console.log('\n✅ 테스트 완료!');
}

// 스크립트 실행
testDataGoKrAPI().catch(console.error);
