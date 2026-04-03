/**
 * lib/v1/cache.ts
 * ===============
 * Redis cache for /api/v1/* routes using ioredis.
 * Falls back to no-cache (direct DB) if Redis unavailable.
 *
 * TTL constants (seconds):
 *   DISCLOSURES    = 300   (5 min)
 *   EVENTS         = 3600  (60 min)
 *   MARKET_RADAR   = 900   (15 min)
 *   SECTOR_SIGNALS = 600   (10 min)
 */

import crypto from 'crypto'

// ── TTL constants ─────────────────────────────────────────────────────────────
export const TTL_DISCLOSURES    = 300
export const TTL_EVENTS         = 3600
export const TTL_MARKET_RADAR   = 900
export const TTL_SECTOR_SIGNALS = 600

// ── Redis singleton ───────────────────────────────────────────────────────────
let _redis: import('ioredis').Redis | null = null
let _initialized = false

async function getRedis(): Promise<import('ioredis').Redis | null> {
  if (_initialized) return _redis

  _initialized = true
  const url = process.env.KV_URL || process.env.REDIS_URL
  if (!url) return null

  try {
    const { default: Redis } = await import('ioredis')
    const client = new Redis(url, {
      connectTimeout:      2000,
      commandTimeout:      2000,
      maxRetriesPerRequest: 1,
      lazyConnect:         true,
      enableOfflineQueue:  false,
    })
    await client.connect()
    await client.ping()
    _redis = client
    console.log('[v1/cache] Redis connected')
  } catch (e) {
    console.warn('[v1/cache] Redis unavailable, running without cache:', e)
    _redis = null
  }

  return _redis
}

// ── Cache key ─────────────────────────────────────────────────────────────────
export function makeCacheKey(prefix: string, params: Record<string, unknown>): string {
  const raw = JSON.stringify(params, Object.keys(params).sort())
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12)
  return `${prefix}:${hash}`
}

// ── get / set ─────────────────────────────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = await getRedis()
  if (!r) return null
  try {
    const raw = await r.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  const r = await getRedis()
  if (!r) return
  try {
    await r.setex(key, ttl, JSON.stringify(value))
  } catch {
    // cache write failure is non-fatal
  }
}
