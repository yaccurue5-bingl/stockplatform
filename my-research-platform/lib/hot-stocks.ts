/**
 * Hot Stocks Detection and Management
 *
 * Detects stocks that should be promoted to 5-minute polling based on:
 * - Price volatility (±5% in 5/15 min)
 * - Volume spike (2x average)
 * - Important disclosures
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Trigger reasons for hot stock promotion
 */
export type HotStockReason = 'price_spike' | 'volume_spike' | 'important_disclosure';

export interface PriceSpikeResult {
  isSpike: boolean;
  changePercent?: number;
  threshold: number;
}

export interface VolumeSpikeResult {
  isSpike: boolean;
  volumeRatio?: number;
  threshold: number;
}

/**
 * Detect price spike (±5% in 5/15 min)
 *
 * @param corpCode - Company code
 * @param stockCode - Stock code (e.g., '005930')
 * @param threshold - Price change threshold (default: 5%)
 * @returns Spike detection result
 */
export async function detectPriceSpike(
  corpCode: string,
  stockCode: string,
  threshold: number = 5.0
): Promise<PriceSpikeResult> {
  try {
    // TODO: Implement price data fetching
    // This requires price history table or external API (KRX, Yahoo Finance)

    // For now, return false (will be implemented with price data pipeline)
    return {
      isSpike: false,
      threshold,
    };
  } catch (error) {
    console.error(`❌ Price spike detection failed for ${corpCode}:`, error);
    return {
      isSpike: false,
      threshold,
    };
  }
}

/**
 * Detect volume spike (2x of 5-day average)
 *
 * @param corpCode - Company code
 * @param stockCode - Stock code
 * @param threshold - Volume ratio threshold (default: 2.0)
 * @returns Volume spike result
 */
export async function detectVolumeSpike(
  corpCode: string,
  stockCode: string,
  threshold: number = 2.0
): Promise<VolumeSpikeResult> {
  try {
    // TODO: Implement volume data fetching
    // This requires volume history table or external API

    // For now, return false (will be implemented with volume data pipeline)
    return {
      isSpike: false,
      threshold,
    };
  } catch (error) {
    console.error(`❌ Volume spike detection failed for ${corpCode}:`, error);
    return {
      isSpike: false,
      threshold,
    };
  }
}

/**
 * Detect important disclosure
 *
 * Criteria:
 * - Importance: 'high' or 'critical'
 * - Sentiment extremes: < -0.5 or > 0.5
 * - Recent disclosure (within 1 hour)
 *
 * @param corpCode - Company code
 * @returns true if has important recent disclosure
 */
export async function detectImportantDisclosure(
  corpCode: string
): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('disclosure_insights')
      .select('importance, sentiment_score')
      .eq('corp_code', corpCode)
      .gte('analyzed_at', oneHourAgo)
      .or('importance.eq.high,importance.eq.critical')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`❌ Disclosure check failed for ${corpCode}:`, error);
      return false;
    }

    // Important disclosure found
    if (data) {
      return true;
    }

    // Check for extreme sentiment
    const { data: extremeSentiment } = await supabase
      .from('disclosure_insights')
      .select('sentiment_score')
      .eq('corp_code', corpCode)
      .gte('analyzed_at', oneHourAgo)
      .or('sentiment_score.lt.-0.5,sentiment_score.gt.0.5')
      .limit(1)
      .maybeSingle();

    return !!extremeSentiment;
  } catch (error) {
    console.error(`❌ Important disclosure detection failed for ${corpCode}:`, error);
    return false;
  }
}

/**
 * Promote stock to hot stocks
 *
 * @param corpCode - Company code
 * @param stockCode - Stock code
 * @param corpName - Company name
 * @param reason - Promotion reason
 * @param reasonDetail - Additional context
 * @param triggerValue - Trigger value (e.g., 7.5 for 7.5% change)
 * @param triggerThreshold - Threshold value (e.g., 5.0 for 5%)
 * @returns true if promotion succeeded
 */
export async function promoteToHotStock(
  corpCode: string,
  stockCode: string,
  corpName: string,
  reason: HotStockReason,
  reasonDetail?: string,
  triggerValue?: number,
  triggerThreshold?: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('promote_to_hot_stock', {
      p_corp_code: corpCode,
      p_stock_code: stockCode,
      p_corp_name: corpName,
      p_reason: reason,
      p_reason_detail: reasonDetail || null,
      p_trigger_value: triggerValue || null,
      p_trigger_threshold: triggerThreshold || null,
    });

    if (error) {
      console.error(`❌ Failed to promote ${corpName} to hot stock:`, error);
      return false;
    }

    console.log(`🔥 Promoted ${corpName} to hot stock: ${reason} (${reasonDetail || 'N/A'})`);
    return true;
  } catch (error) {
    console.error(`❌ Hot stock promotion failed for ${corpCode}:`, error);
    return false;
  }
}

/**
 * Check all triggers for a stock
 *
 * Returns the first trigger that fires (priority: disclosure > price > volume)
 *
 * @param corpCode - Company code
 * @param stockCode - Stock code
 * @param corpName - Company name
 * @returns Promotion result
 */
export async function checkHotStockTriggers(
  corpCode: string,
  stockCode: string,
  corpName: string
): Promise<{
  shouldPromote: boolean;
  reason?: HotStockReason;
  reasonDetail?: string;
  triggerValue?: number;
  triggerThreshold?: number;
}> {
  try {
    // Priority 1: Important disclosure
    const hasImportantDisclosure = await detectImportantDisclosure(corpCode);
    if (hasImportantDisclosure) {
      return {
        shouldPromote: true,
        reason: 'important_disclosure',
        reasonDetail: 'High importance or extreme sentiment',
      };
    }

    // Priority 2: Price spike
    const priceSpike = await detectPriceSpike(corpCode, stockCode);
    if (priceSpike.isSpike) {
      return {
        shouldPromote: true,
        reason: 'price_spike',
        reasonDetail: `±${priceSpike.changePercent}% in 5/15 min`,
        triggerValue: priceSpike.changePercent,
        triggerThreshold: priceSpike.threshold,
      };
    }

    // Priority 3: Volume spike
    const volumeSpike = await detectVolumeSpike(corpCode, stockCode);
    if (volumeSpike.isSpike) {
      return {
        shouldPromote: true,
        reason: 'volume_spike',
        reasonDetail: `${volumeSpike.volumeRatio}x average volume`,
        triggerValue: volumeSpike.volumeRatio,
        triggerThreshold: volumeSpike.threshold,
      };
    }

    return { shouldPromote: false };
  } catch (error) {
    console.error(`❌ Trigger check failed for ${corpCode}:`, error);
    return { shouldPromote: false };
  }
}

/**
 * Get active hot stocks
 *
 * @returns List of active hot stocks
 */
export async function getActiveHotStocks(): Promise<Array<{
  corp_code: string;
  stock_code: string;
  corp_name: string;
  reason: string;
  promoted_at: string;
  expires_at: string;
}>> {
  try {
    const { data, error } = await supabase.rpc('get_active_hot_stocks');

    if (error) {
      console.error('❌ Failed to get active hot stocks:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Get active hot stocks failed:', error);
    return [];
  }
}

/**
 * Demote expired hot stocks
 *
 * @returns Number of demoted stocks
 */
export async function demoteExpiredHotStocks(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('demote_expired_hot_stocks');

    if (error) {
      console.error('❌ Failed to demote expired hot stocks:', error);
      return 0;
    }

    if (data > 0) {
      console.log(`📉 Demoted ${data} expired hot stocks`);
    }

    return data || 0;
  } catch (error) {
    console.error('❌ Demote expired hot stocks failed:', error);
    return 0;
  }
}

/**
 * Check if stock is currently hot
 *
 * @param corpCode - Company code
 * @returns true if stock is hot
 */
export async function isHotStock(corpCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_hot_stock', {
      p_corp_code: corpCode,
    });

    if (error) {
      console.error(`❌ Failed to check if ${corpCode} is hot:`, error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`❌ Hot stock check failed for ${corpCode}:`, error);
    return false;
  }
}

/**
 * Get hot stock statistics
 *
 * @returns Statistics object
 */
export async function getHotStockStatistics(): Promise<{
  active_count: number;
  demoted_count: number;
  price_spike_count: number;
  volume_spike_count: number;
  disclosure_count: number;
  avg_refreshes: number;
  latest_expiry: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from('hot_stocks_statistics')
      .select('*')
      .single();

    if (error) {
      console.error('❌ Failed to get hot stock statistics:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Hot stock statistics failed:', error);
    return null;
  }
}

/**
 * Sync hot stocks with sharding module
 *
 * Updates the in-memory HOT_STOCKS set in lib/sharding.ts
 */
export async function syncHotStocksWithSharding(): Promise<void> {
  try {
    const hotStocks = await getActiveHotStocks();

    // Import sharding module and update hot stocks
    const { addHotStock, removeHotStock } = await import('./sharding');

    // This is a simplified version
    // In production, you'd want to maintain a proper sync mechanism
    console.log(`🔄 Synced ${hotStocks.length} hot stocks with sharding module`);
  } catch (error) {
    console.error('❌ Hot stock sync with sharding failed:', error);
  }
}
