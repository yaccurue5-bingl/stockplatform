import type { Metadata } from 'next';
import EventLandingPage from '@/components/landing/EventLandingPage';
import type { EventLandingConfig } from '@/components/landing/EventLandingPage';
import { fetchEventTableRows } from '@/lib/fetchEventTableRows';

export const metadata: Metadata = {
  title: 'Korea Earnings Signals API | K-Market Insight',
  description:
    'Real-time structured earnings disclosure data from 2,400+ Korean listed companies (KOSPI & KOSDAQ). AI-scored signals, sentiment analysis, and historical backtesting data via REST API.',
  keywords: [
    'Korea earnings API',
    'KOSPI earnings signals',
    'KOSDAQ earnings disclosure',
    'Korean stock earnings data',
    'Korea corporate earnings API',
    'Korea financial disclosure API',
  ],
  openGraph: {
    title: 'Korea Earnings Signals API | K-Market Insight',
    description: 'Structured earnings disclosure data from Korean listed companies via REST API.',
    url: 'https://k-marketinsight.com/korea-earnings-signals',
    siteName: 'K-Market Insight',
    type: 'website',
  },
};

const cfg: EventLandingConfig = {
  slug: 'korea-earnings-signals',
  title: 'Korea Earnings\nSignals API',
  subtitle:
    'Structured earnings disclosure data from 2,400+ Korean listed companies. AI-scored sentiment, financial impact, and historical return statistics — delivered via REST API.',
  description:
    'Real-time structured earnings disclosure data from Korean listed companies via REST API.',
  badge: 'EARNINGS · KOSPI & KOSDAQ',

  stats: [
    { value: '2,400+', label: 'Listed Companies' },
    { value: '15,000+', label: 'Earnings Disclosures' },
    { value: '~15 min', label: 'Update Latency' },
    { value: 'Since 2010', label: 'Historical Depth' },
  ],

  whatTitle: 'What Are Korea Earnings Signals?',
  whatBody:
    'Korean listed companies are required by the Financial Supervisory Service (FSS) to disclose quarterly and annual earnings results via DART (Data Analysis, Retrieval and Transfer System). These disclosures include revenue, operating profit, net income, and forward guidance. Our API processes every earnings filing in near real-time, extracts structured financial metrics using AI, and assigns a signal score based on sentiment, financial impact, and historical market reaction patterns.',

  features: [
    {
      icon: 'zap',
      title: 'Real-time Earnings Alerts',
      body: 'Earnings filings are ingested from DART within 15 minutes of publication. Each event is classified, scored, and available via API before market reaction sets in.',
    },
    {
      icon: 'trending',
      title: 'AI Sentiment & Impact Score',
      body: 'Every earnings disclosure is analyzed by LLM to extract sentiment (-1 to +1), short-term impact score (0–100), and key financial metrics — no parsing required.',
    },
    {
      icon: 'db',
      title: 'Historical Return Statistics',
      body: 'Aggregate 1-day, 5-day, and 20-day return statistics per event type, derived from 15+ years of Korean market data. Use these baselines for backtest calibration.',
    },
  ],

  steps: [
    {
      num: '1',
      title: 'DART Filing Detected',
      body: 'Earnings disclosure published by company to FSS DART system.',
    },
    {
      num: '2',
      title: 'Content Extraction',
      body: 'Full disclosure text extracted, cleaned, and normalized from XML.',
    },
    {
      num: '3',
      title: 'AI Analysis',
      body: 'LLM scores sentiment, impact, key numbers, and risk factors.',
    },
    {
      num: '4',
      title: 'API Available',
      body: 'Structured JSON result available via /v1/events endpoint within ~15 min.',
    },
  ],

  tableTitle: 'Live Earnings Signal Output',
  tableHeaders: ['Company', 'Date', 'Sentiment', 'Impact Score', 'Signal'],
  tableRows: [], // runtime에 실데이터로 교체됨

  useCases: [
    {
      title: 'Quant Funds & Systematic Traders',
      body: 'Integrate earnings signal scores directly into factor models. Use historical return stats to calibrate expected alpha from earnings-driven events.',
    },
    {
      title: 'Fintech & Investment Apps',
      body: 'Display structured earnings summaries, sentiment badges, and impact scores in your app without building your own NLP pipeline.',
    },
    {
      title: 'Research & Academia',
      body: 'Access 15+ years of structured Korean earnings data for event studies, cross-sectional return analysis, and market microstructure research.',
    },
  ],
};

export default async function KoreaEarningsSignalsPage() {
  const tableRows = await fetchEventTableRows('EARNINGS', 5);
  return <EventLandingPage cfg={{ ...cfg, tableRows }} />;
}
