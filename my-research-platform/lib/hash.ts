/**
 * Hash Strategy for K-MarketInsight
 *
 * 3-Layer Defense System:
 * 1. Disclosure Hash: Prevents duplicate disclosure processing
 * 2. Bundle Hash: Prevents duplicate Sonnet calls for same stock/time
 * 3. Revision Hash: Allows re-processing for correction disclosures
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * 1️⃣ Disclosure Hash (Primary Defense)
 * Prevents duplicate Groq analysis for same disclosure
 */
export function generateDisclosureHash(corpCode: string, rceptNo: string): string {
  const raw = `${corpCode}_${rceptNo}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Check if disclosure already processed
 */
export async function isDisclosureProcessed(
  corpCode: string,
  rceptNo: string
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('disclosure_hashes')
    .select('id')
    .eq('corp_code', corpCode)
    .eq('rcept_no', rceptNo)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('Error checking disclosure hash:', error);
    return false; // 에러 시 중복 아님으로 처리 (재시도 허용)
  }

  return !!data;
}

/**
 * Register disclosure as processed
 */
export async function registerDisclosureHash(params: {
  corpCode: string;
  rceptNo: string;
  corpName: string;
  reportName: string;
  isRevision?: boolean;
  originalRceptNo?: string;
}): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const hashKey = generateDisclosureHash(params.corpCode, params.rceptNo);

  const { error } = await supabase
    .from('disclosure_hashes')
    .upsert({
      hash_key: hashKey,
      corp_code: params.corpCode,
      rcept_no: params.rceptNo,
      corp_name: params.corpName,
      report_name: params.reportName,
      is_revision: params.isRevision || false,
      original_rcept_no: params.originalRceptNo || null,
      groq_analyzed: true,
      groq_analyzed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일
    }, {
      onConflict: 'hash_key'
    });

  if (error) {
    console.error('Error registering disclosure hash:', error);
  }
}

/**
 * 2️⃣ Bundle Hash (Sonnet Protection)
 * Prevents duplicate Sonnet calls for same stock/time bucket
 */
export function generateBundleHash(
  corpCode: string,
  date: Date,
  timeBucket: string
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const raw = `${corpCode}_${dateStr}_${timeBucket}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Get current time bucket (15-minute intervals)
 */
export function getCurrentTimeBucket(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = Math.floor(now.getMinutes() / 15) * 15;
  const minutesStr = String(minutes).padStart(2, '0');
  return `${hours}${minutesStr}`;
}

/**
 * Check if Sonnet already called for this bundle
 */
export async function isBundleSonnetCalled(
  corpCode: string,
  date: Date,
  timeBucket: string
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const dateStr = date.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('bundle_hashes')
    .select('id')
    .eq('corp_code', corpCode)
    .eq('bundle_date', dateStr)
    .eq('time_bucket', timeBucket)
    .eq('sonnet_called', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('Error checking bundle hash:', error);
    return false;
  }

  return !!data;
}

/**
 * Register Sonnet call for bundle
 */
export async function registerBundleSonnet(params: {
  corpCode: string;
  date: Date;
  timeBucket: string;
  corpName: string;
  disclosureCount: number;
  tokensUsed: number;
}): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const hashKey = generateBundleHash(params.corpCode, params.date, params.timeBucket);
  const dateStr = params.date.toISOString().split('T')[0];

  const { error } = await supabase
    .from('bundle_hashes')
    .upsert({
      hash_key: hashKey,
      corp_code: params.corpCode,
      bundle_date: dateStr,
      time_bucket: params.timeBucket,
      corp_name: params.corpName,
      disclosure_count: params.disclosureCount,
      total_tokens_used: params.tokensUsed,
      sonnet_called: true,
      sonnet_called_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1시간
    }, {
      onConflict: 'hash_key'
    });

  if (error) {
    console.error('Error registering bundle hash:', error);
  }
}

/**
 * 3️⃣ Revision Detection
 * Check if disclosure is a revision/correction
 */
export function isRevisionDisclosure(reportName: string): boolean {
  const revisionKeywords = ['정정', '재공시', '정정공시', '수정'];
  return revisionKeywords.some(keyword => reportName.includes(keyword));
}

/**
 * Invalidate original disclosure if revision exists
 */
export async function invalidateOriginalDisclosure(
  corpCode: string,
  originalRceptNo: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 원본 공시 hash 만료
  const { error } = await supabase
    .from('disclosure_hashes')
    .update({
      expires_at: new Date().toISOString(), // 즉시 만료
    })
    .eq('corp_code', corpCode)
    .eq('rcept_no', originalRceptNo);

  if (error) {
    console.error('Error invalidating original disclosure:', error);
  }
}

/**
 * Cleanup expired hashes
 * Should be called by a cron job
 */
export async function cleanupExpiredHashes(): Promise<number> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // disclosure_hashes 정리
  const { error: error1 } = await supabase
    .from('disclosure_hashes')
    .delete()
    .lt('expires_at', new Date().toISOString());

  // bundle_hashes 정리
  const { error: error2 } = await supabase
    .from('bundle_hashes')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error1 || error2) {
    console.error('Error cleaning up hashes:', error1, error2);
    return 0;
  }

  return 1; // Success
}

/**
 * Get hash statistics
 */
export async function getHashStatistics(): Promise<{
  disclosureHashes: {
    total: number;
    groqAnalyzed: number;
    sonnetAnalyzed: number;
    revisions: number;
  };
  bundleHashes: {
    total: number;
    sonnetCalled: number;
  };
}> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: disclosureStats } = await supabase
    .from('disclosure_hashes')
    .select('groq_analyzed, sonnet_analyzed, is_revision')
    .gt('expires_at', new Date().toISOString());

  const { data: bundleStats } = await supabase
    .from('bundle_hashes')
    .select('sonnet_called')
    .gt('expires_at', new Date().toISOString());

  return {
    disclosureHashes: {
      total: disclosureStats?.length || 0,
      groqAnalyzed: disclosureStats?.filter(d => d.groq_analyzed).length || 0,
      sonnetAnalyzed: disclosureStats?.filter(d => d.sonnet_analyzed).length || 0,
      revisions: disclosureStats?.filter(d => d.is_revision).length || 0,
    },
    bundleHashes: {
      total: bundleStats?.length || 0,
      sonnetCalled: bundleStats?.filter(b => b.sonnet_called).length || 0,
    },
  };
}
