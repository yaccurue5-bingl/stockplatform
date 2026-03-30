import type { Metadata } from 'next';
import EventLandingPage from '@/components/landing/EventLandingPage';
import type { EventLandingConfig } from '@/components/landing/EventLandingPage';

export const metadata: Metadata = {
  title: 'Korea Contract Signals API | K-Market Insight',
  description:
    'Real-time structured data on major supply agreements and contract disclosures from Korean listed companies. AI-scored contract signals with financial impact analysis via REST API.',
  keywords: [
    'Korea contract signals API',
    'Korea supply agreement data',
    'KOSPI contract disclosure',
    'Korea business contract API',
    'Korean corporate contract filings',
    'Korea major contract alert API',
  ],
  openGraph: {
    title: 'Korea Contract Signals API | K-Market Insight',
    description: 'Structured contract disclosure data from Korean listed companies via REST API.',
    url: 'https://k-marketinsight.com/korea-contract-signals',
    siteName: 'K-Market Insight',
    type: 'website',
  },
};

const cfg: EventLandingConfig = {
  slug: 'korea-contract-signals',
  title: 'Korea Contract\nSignals API',
  subtitle:
    'Structured data on major supply agreements and contract disclosures from Korean listed companies. Identify revenue-driving contracts as soon as they hit the market.',
  description:
    'Structured contract disclosure data from Korean listed companies via REST API.',
  badge: 'CONTRACT · SUPPLY AGREEMENTS',

  stats: [
    { value: '400+', label: 'Contract Disclosures' },
    { value: '2,400+', label: 'Listed Companies' },
    { value: '~15 min', label: 'Update Latency' },
    { value: 'Govt & Private', label: 'Contract Types' },
  ],

  whatTitle: 'What Are Korea Contract Signals?',
  whatBody:
    'Korean listed companies are required to disclose major contracts when the contract value exceeds a materiality threshold relative to their revenue. These disclosures — filed via DART — include the contract counterparty, total value, duration, and purpose. Large government or private supply agreements are frequently strong positive catalysts. Our API processes every contract filing, extracts the deal size relative to company revenue, identifies the counterparty type, and scores the financial impact on a standardized scale.',

  features: [
    {
      icon: 'trending',
      title: 'Contract Size Relative to Revenue',
      body: 'AI extracts deal value and computes it as a percentage of annual revenue — the single most important factor in contract-driven price moves.',
    },
    {
      icon: 'zap',
      title: 'Counterparty Classification',
      body: 'Contracts are tagged by counterparty type: government, large conglomerate (chaebol), foreign buyer, or domestic private. Each carries distinct signal strength.',
    },
    {
      icon: 'db',
      title: 'Historical Pattern Statistics',
      body: 'Average 1-day and 5-day returns for contract events by counterparty type and deal size — calibrate your model with 15+ years of Korean market data.',
    },
  ],

  steps: [
    {
      num: '1',
      title: 'Contract Filed',
      body: 'Company discloses major supply agreement or contract award to DART.',
    },
    {
      num: '2',
      title: 'Deal Parsed',
      body: 'AI extracts value, counterparty, duration, and contract type.',
    },
    {
      num: '3',
      title: 'Impact Scored',
      body: 'Revenue impact %, counterparty quality, and sentiment scored 0–100.',
    },
    {
      num: '4',
      title: 'API Available',
      body: 'Structured result available via /v1/events?event_type=CONTRACT within ~15 min.',
    },
  ],

  tableTitle: 'Sample Contract Signal Output',
  tableHeaders: ['Company', 'Date', 'Counterparty Type', 'Deal / Revenue', 'Impact Score', 'Signal'],
  tableRows: [
    ['Defense Co A', '2026-03-19', 'Government', '42%', '88', 'BULLISH'],
    ['Auto Parts B', '2026-03-18', 'Chaebol', '18%', '72', 'BULLISH'],
    ['IT Services C', '2026-03-17', 'Foreign', '9%', '61', 'BULLISH'],
    ['Small Mfg D', '2026-03-14', 'Domestic', '3%', '44', '—'],
    ['Materials Co E', '2026-03-13', 'Government', '27%', '80', 'BULLISH'],
  ],

  useCases: [
    {
      title: 'Momentum & Event-Driven Traders',
      body: 'Large contract awards — especially government or foreign buyer contracts — are reliable positive catalysts. Get structured signals within 15 minutes of filing.',
    },
    {
      title: 'Fundamental Analysts',
      body: 'Track revenue visibility and backlog growth for coverage companies. Contract-to-revenue ratio is a leading indicator of forward earnings.',
    },
    {
      title: 'Supply Chain Intelligence',
      body: 'Monitor contract flows across the Korean manufacturing, defense, and IT sectors. Identify emerging vendor relationships before they appear in earnings.',
    },
  ],
};

export default function KoreaContractSignalsPage() {
  return <EventLandingPage cfg={cfg} />;
}
