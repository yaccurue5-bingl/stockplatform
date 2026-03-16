/**
 * Hash Cleanup Cron Job
 *
 * Removes expired disclosure and bundle hashes
 * Run daily to maintain database cleanliness
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredHashes, getHashStatistics } from '@/lib/hash';

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

  console.log('🧹 Hash cleanup started...');

  try {
    // 정리 전 통계
    const statsBefore = await getHashStatistics();
    console.log('📊 Before cleanup:', statsBefore);

    // 만료된 hash 정리
    const result = await cleanupExpiredHashes();

    // 정리 후 통계
    const statsAfter = await getHashStatistics();
    console.log('📊 After cleanup:', statsAfter);

    console.log('✅ Hash cleanup completed');

    return NextResponse.json({
      success: true,
      cleaned: result,
      statistics: {
        before: statsBefore,
        after: statsAfter,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Hash cleanup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST 메서드도 지원 (수동 트리거용)
export async function POST(req: NextRequest) {
  return GET(req);
}
