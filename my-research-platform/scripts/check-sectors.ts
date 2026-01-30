#!/usr/bin/env tsx
/**
 * Supabase companies 테이블의 sector 값을 조사하는 스크립트
 * - sector가 null인 기업 수
 * - sector가 "기타"인 기업 목록
 * - 모든 고유한 sector 값들
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function analyzeSectors() {
  console.log('='.repeat(80))
  console.log('Supabase Companies 테이블 Sector 분석')
  console.log('='.repeat(80))

  // 전체 기업 데이터 조회
  const { data: companies, error } = await supabase
    .from('companies')
    .select('code, name_kr, market, sector')
    .order('code')

  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  if (!companies) {
    console.log('❌ No data found')
    process.exit(1)
  }

  console.log(`\n📊 전체 기업 수: ${companies.length}`)

  // Sector 통계
  const nullSectors = companies.filter(c => !c.sector)
  const gitaSectors = companies.filter(c => c.sector === '기타')
  const validSectors = companies.filter(c => c.sector && c.sector !== '기타')

  console.log(`   - Sector NULL: ${nullSectors.length}개`)
  console.log(`   - Sector '기타': ${gitaSectors.length}개`)
  console.log(`   - 유효한 Sector: ${validSectors.length}개`)

  // 고유한 sector 값들
  const sectorCount = new Map<string, number>()
  companies.forEach(c => {
    const sector = c.sector || 'NULL'
    sectorCount.set(sector, (sectorCount.get(sector) || 0) + 1)
  })

  console.log(`\n📋 고유한 Sector 값 (${sectorCount.size}개):`)
  const sortedSectors = Array.from(sectorCount.entries()).sort((a, b) => b[1] - a[1])
  sortedSectors.forEach(([sector, count]) => {
    console.log(`   ${sector}: ${count}개`)
  })

  // BYC 확인
  console.log('\n' + '='.repeat(80))
  console.log('🔍 BYC 기업 정보')
  console.log('='.repeat(80))

  const { data: bycCompanies } = await supabase
    .from('companies')
    .select('*')
    .ilike('name_kr', '%BYC%')

  if (bycCompanies && bycCompanies.length > 0) {
    bycCompanies.forEach(company => {
      console.log(`종목코드: ${company.code}`)
      console.log(`기업명: ${company.name_kr}`)
      console.log(`시장: ${company.market}`)
      console.log(`업종: ${company.sector || 'NULL'}`)
      console.log(`영문명: ${company.name_en || 'N/A'}`)
      console.log(`업데이트: ${company.updated_at}`)
      console.log()
    })
  } else {
    console.log('BYC를 찾을 수 없습니다.')
  }

  // "기타"로 분류된 기업 목록 (상위 30개)
  if (gitaSectors.length > 0) {
    console.log('='.repeat(80))
    console.log(`📌 '기타'로 분류된 기업 목록 (상위 30개 / 전체 ${gitaSectors.length}개)`)
    console.log('='.repeat(80))
    gitaSectors.slice(0, 30).forEach((company, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${company.code.padEnd(6, ' ')} | ${(company.name_kr || '').padEnd(20, ' ')} | ${company.market || 'N/A'}`)
    })
  }

  // Sector가 NULL인 기업 목록 (상위 30개)
  if (nullSectors.length > 0) {
    console.log('\n' + '='.repeat(80))
    console.log(`📌 Sector가 NULL인 기업 목록 (상위 30개 / 전체 ${nullSectors.length}개)`)
    console.log('='.repeat(80))
    nullSectors.slice(0, 30).forEach((company, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${company.code.padEnd(6, ' ')} | ${(company.name_kr || '').padEnd(20, ' ')} | ${company.market || 'N/A'}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('분석 완료')
  console.log('='.repeat(80))
}

analyzeSectors().catch(console.error)
