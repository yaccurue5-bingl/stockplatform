/**
 * Sharding Strategy for K-MarketInsight
 *
 * Distributes stock processing across time windows within 15-minute cron cycles
 * to prevent API overload and ensure stable operation
 *
 * Key Benefits:
 * - Distributes crawling load across 15-min window
 * - Prevents simultaneous Groq/Sonnet calls
 * - Scales without adding more cron jobs
 */

import crypto from 'crypto';

/**
 * Default shard count
 * Recommended by stock count:
 * - ~30 stocks: 1 (no sharding needed)
 * - 30~100: 3
 * - 100~300: 5
 * - 300~1000: 10
 */
const DEFAULT_SHARD_COUNT = parseInt(process.env.SHARD_COUNT || '3', 10);

/**
 * Assign shard number based on corp_code hash
 *
 * @param corpCode - Company code (e.g., '00126380')
 * @param shardCount - Total number of shards
 * @returns Shard number (0 to shardCount-1)
 */
export function assignShard(corpCode: string, shardCount: number = DEFAULT_SHARD_COUNT): number {
  // Use MD5 hash for consistent distribution
  const hash = crypto.createHash('md5').update(corpCode).digest('hex');
  // Convert first 8 hex chars to number
  const hashNum = parseInt(hash.substring(0, 8), 16);
  return hashNum % shardCount;
}

/**
 * Get current time window within 15-minute cycle
 *
 * Window mapping (for 3 shards):
 * - 00~04 min: window 0
 * - 05~09 min: window 1
 * - 10~14 min: window 2
 *
 * @param now - Current date
 * @param shardCount - Total number of shards
 * @returns Current window number (0 to shardCount-1)
 */
export function getCurrentWindow(now: Date = new Date(), shardCount: number = DEFAULT_SHARD_COUNT): number {
  const minute = now.getMinutes() % 15; // 0~14
  const windowSize = Math.floor(15 / shardCount); // 3 shards → 5 min each
  return Math.floor(minute / windowSize);
}

/**
 * Check if this corp should be processed in current window
 *
 * @param corpCode - Company code
 * @param now - Current date (default: now)
 * @param shardCount - Total number of shards
 * @returns true if should process now
 */
export function shouldProcessNow(
  corpCode: string,
  now: Date = new Date(),
  shardCount: number = DEFAULT_SHARD_COUNT
): boolean {
  const shard = assignShard(corpCode, shardCount);
  const currentWindow = getCurrentWindow(now, shardCount);
  return shard === currentWindow;
}

/**
 * Get window range for a shard
 *
 * @param shard - Shard number
 * @param shardCount - Total number of shards
 * @returns { start: number, end: number } - Minute range (0~14)
 */
export function getWindowRange(shard: number, shardCount: number = DEFAULT_SHARD_COUNT): { start: number; end: number } {
  const windowSize = Math.floor(15 / shardCount);
  return {
    start: shard * windowSize,
    end: Math.min((shard + 1) * windowSize - 1, 14),
  };
}

/**
 * Get all corp codes assigned to a specific shard
 *
 * @param corpCodes - List of all corp codes
 * @param shard - Shard number
 * @param shardCount - Total number of shards
 * @returns Corp codes for this shard
 */
export function getCorpsForShard(
  corpCodes: string[],
  shard: number,
  shardCount: number = DEFAULT_SHARD_COUNT
): string[] {
  return corpCodes.filter(code => assignShard(code, shardCount) === shard);
}

/**
 * Distribution statistics (for monitoring)
 *
 * @param corpCodes - List of all corp codes
 * @param shardCount - Total number of shards
 * @returns Distribution map
 */
export function getShardDistribution(
  corpCodes: string[],
  shardCount: number = DEFAULT_SHARD_COUNT
): Map<number, string[]> {
  const distribution = new Map<number, string[]>();

  for (let i = 0; i < shardCount; i++) {
    distribution.set(i, []);
  }

  corpCodes.forEach(code => {
    const shard = assignShard(code, shardCount);
    distribution.get(shard)?.push(code);
  });

  return distribution;
}

/**
 * HOT STOCKS (Priority Processing)
 * These stocks bypass sharding and are always processed
 *
 * Criteria:
 * - High trading volume
 * - Multiple disclosures
 * - Premium user watchlist
 */
const HOT_STOCKS = new Set<string>([
  // TODO: Add hot stock codes here
  // Example: '005930', // Samsung Electronics
]);

/**
 * Check if stock should be processed immediately (bypass sharding)
 *
 * @param corpCode - Company code
 * @returns true if hot stock
 */
export function isHotStock(corpCode: string): boolean {
  return HOT_STOCKS.has(corpCode);
}

/**
 * Add stock to hot list (runtime)
 *
 * @param corpCode - Company code
 */
export function addHotStock(corpCode: string): void {
  HOT_STOCKS.add(corpCode);
}

/**
 * Remove stock from hot list
 *
 * @param corpCode - Company code
 */
export function removeHotStock(corpCode: string): void {
  HOT_STOCKS.delete(corpCode);
}

/**
 * Get sharding configuration
 */
export function getShardingConfig() {
  return {
    shardCount: DEFAULT_SHARD_COUNT,
    windowSize: Math.floor(15 / DEFAULT_SHARD_COUNT),
    hotStocksCount: HOT_STOCKS.size,
  };
}

/**
 * Get current status (for monitoring)
 */
export function getShardingStatus(now: Date = new Date()) {
  const currentWindow = getCurrentWindow(now, DEFAULT_SHARD_COUNT);
  const range = getWindowRange(currentWindow, DEFAULT_SHARD_COUNT);

  return {
    config: getShardingConfig(),
    current: {
      window: currentWindow,
      range: `${range.start}~${range.end} min`,
      minute: now.getMinutes() % 15,
    },
  };
}
