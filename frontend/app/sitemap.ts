/**
 * sitemap.ts — 단일 파일 사이트맵
 *
 * generateSitemaps()를 쓰면 Next.js 15+에서 /sitemap.xml이 404가 되는 이슈가 있어
 * 단일 export default 방식으로 구현.
 *
 * 현재 17,700+ 시그널 — Google 한도(50,000)에 여유 있음.
 * .limit(25000)으로 한 번에 fetch → 24h ISR 캐시로 DB 부하 최소화.
 */

import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 86400; // 24h

const SITE_URL = 'https://k-marketinsight.com';

async function fetchAllSignalIds(): Promise<{ id: string; updated_at: string | null }[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('disclosure_insights')
      .select('id, updated_at')
      .eq('is_visible', true)
      .eq('analysis_status', 'completed')
      .order('rcept_dt', { ascending: false })
      .limit(25000); // 현재 ~17,703개 — 여유분 포함
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const signals = await fetchAllSignalIds();

  const signalUrls: MetadataRoute.Sitemap = signals.map((s) => ({
    url: `${SITE_URL}/signal/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    // ── 정적 페이지 ──────────────────────────────────────────────────────────
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/datasets`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/api-docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/korea-earnings-signals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/korea-dilution-filings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/korea-contract-signals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // ── 시그널 페이지 (동적) ──────────────────────────────────────────────────
    ...signalUrls,
  ];
}
