import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

const SITE_URL = "https://k-marketinsight.com";

async function fetchRecentSignalIds(): Promise<{ id: string; updated_at: string | null }[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("disclosure_insights")
      .select("id, updated_at")
      .eq("is_visible", true)
      .eq("analysis_status", "completed")
      .order("rcept_dt", { ascending: false })
      .limit(500);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const signals = await fetchRecentSignalIds();

  const signalUrls: MetadataRoute.Sitemap = signals.map((s) => ({
    url: `${SITE_URL}/signal/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/datasets`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/api-docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // 이벤트 타입별 SEO 랜딩 페이지 (가이드 3.1 참조)
    {
      url: `${SITE_URL}/korea-earnings-signals`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/korea-dilution-filings`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/korea-contract-signals`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    // 개별 시그널 페이지 (최대 500개, 동적)
    ...signalUrls,
  ];
}
