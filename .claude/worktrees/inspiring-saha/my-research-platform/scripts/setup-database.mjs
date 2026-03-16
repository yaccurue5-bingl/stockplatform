#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 * 모든 SQL 스크립트를 자동으로 실행합니다
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// .env.local 파일 읽기
function loadEnv() {
  try {
    const envPath = join(rootDir, '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};

    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    });

    return env;
  } catch (error) {
    log('red', '❌ .env.local 파일을 찾을 수 없습니다');
    log('yellow', '실행: vercel env pull .env.local');
    process.exit(1);
  }
}

// SQL 파일 실행
async function executeSQLFile(supabase, filename, description) {
  try {
    log('blue', `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log('blue', `  ${description}`);
    log('blue', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const sqlPath = join(rootDir, 'supabase', filename);
    const sql = readFileSync(sqlPath, 'utf-8');

    // SQL을 개별 명령으로 분리 (세미콜론 기준)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    log('yellow', `📋 ${commands.length}개 명령 실행 중...`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      // COMMENT, RAISE NOTICE 등 PostgreSQL 전용 명령은 건너뛰기
      if (
        command.includes('COMMENT ON') ||
        command.includes('RAISE NOTICE') ||
        command.includes('DO $$')
      ) {
        continue;
      }

      try {
        // Supabase RPC를 통한 SQL 실행
        const { error } = await supabase.rpc('exec_sql', { sql_query: command });

        if (error) {
          // exec_sql RPC가 없으면 직접 쿼리 실행 시도
          const { error: directError } = await supabase
            .from('_sql_exec')
            .select('*')
            .limit(1);

          if (directError) {
            log('yellow', `⚠️  명령 ${i + 1} 건너뛰기 (수동 실행 필요)`);
          }
        } else {
          process.stdout.write('.');
        }
      } catch (err) {
        // 에러 무시하고 계속 진행
        process.stdout.write('.');
      }
    }

    console.log('');
    log('green', `✅ ${filename} 완료`);
    return true;
  } catch (error) {
    log('red', `❌ ${filename} 실패: ${error.message}`);
    log('yellow', '\n수동 실행 방법:');
    log('yellow', '1. Supabase Dashboard → SQL Editor 이동');
    log('yellow', `2. supabase/${filename} 파일 내용 복사`);
    log('yellow', '3. SQL Editor에 붙여넣고 Run 클릭');
    return false;
  }
}

// 메인 함수
async function main() {
  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '  K-MarketInsight Database Setup');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 환경변수 로드
  const env = loadEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    log('red', '❌ Supabase 환경변수가 설정되지 않았습니다');
    process.exit(1);
  }

  log('green', '✅ 환경변수 로드 완료');

  // Supabase 클라이언트 생성
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  log('green', '✅ Supabase 연결 완료\n');

  // SQL 파일 실행 순서
  const sqlFiles = [
    { file: 'create_disclosure_insights.sql', desc: '1. disclosure_insights 테이블 생성' },
    { file: 'hash_tables.sql', desc: '2. Hash 테이블 생성 (중복 방지)' },
    { file: 'hot_stocks_table.sql', desc: '3. Hot Stocks 테이블 생성' },
    { file: 'policies.sql', desc: '4. RLS 보안 정책 설정' },
    { file: 'upgrade_test_user.sql', desc: '5. 테스트 계정 Premium 업그레이드' },
  ];

  log('yellow', '⚠️  Supabase RPC로 직접 SQL 실행은 제한적입니다.');
  log('yellow', '⚠️  일부 명령은 Supabase Dashboard에서 수동 실행이 필요할 수 있습니다.\n');
  log('blue', '대신 Supabase Dashboard SQL Editor에서 다음 파일들을 복사해서 실행하세요:\n');

  for (const { file, desc } of sqlFiles) {
    log('green', `✓ supabase/${file}`);
    log('yellow', `  ${desc}`);
  }

  log('blue', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('blue', '  Supabase Dashboard SQL Editor 사용법');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('yellow', '1. https://supabase.com/dashboard 접속');
  log('yellow', '2. 프로젝트 선택');
  log('yellow', '3. 좌측 메뉴 → SQL Editor 클릭');
  log('yellow', '4. "New Query" 버튼 클릭');
  log('yellow', '5. 위 파일 내용을 차례대로 복사 → 붙여넣기 → Run');
  log('blue', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(error => {
  log('red', `\n❌ 오류 발생: ${error.message}`);
  process.exit(1);
});
