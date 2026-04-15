import type { Metadata } from 'next';
import EventLandingPage from '@/components/landing/EventLandingPage';
import type { EventLandingConfig } from '@/components/landing/EventLandingPage';
import { fetchEventTableRows } from '@/lib/fetchEventTableRows';

export const metadata: Metadata = {
  title: 'Korea Dilution Filings API | K-Market Insight',
  description:
    'Track new share issuances, rights offerings, and convertible bond filings from Korean listed companies in real-time. Structured dilution data with AI impact scoring via REST API.',
  keywords: [
    'Korea dilution filings API',
    'Korea share issuance data',
    'KOSPI dilution signals',
    'Korea rights offering API',
    'Korean convertible bond data',
    'Korea stock dilution API',
  ],
  openGraph: {
    title: 'Korea Dilution Filings API | K-Market Insight',
    description: 'Structured dilution filing data from Korean listed companies via REST API.',
    url: 'https://k-marketinsight.com/korea-dilution-filings',
    siteName: 'K-Market Insight',
    type: 'website',
  },
};

const cfg: EventLandingConfig = {
  slug: 'korea-dilution-filings',
  title: 'Korea Dilution\nFilings API',
  subtitle:
    'Real-time structured data on new share issuances, rights offerings, and convertible bond filings from Korean listed companies. Know before the market prices in dilution risk.',
  description:
    'Structured dilution filing data from Korean listed companies via REST API.',
  badge: 'DILUTION · NEW SHARES & CB',

  stats: [
    { value: '1,900+', label: 'Dilution Filings' },
    { value: '2,400+', label: 'Listed Companies' },
    { value: '~15 min', label: 'Update Latency' },
    { value: '3 Types', label: 'Rights / CB / BW' },
  ],

  whatTitle: 'What Are Korea Dilution Filings?',
  whatBody:
    'Korean companies must disclose any decision to issue new shares, convertible bonds (CB), or bond-with-warrant (BW) instruments through DART. These events typically signal dilution risk — increasing the share count lowers EPS and can pressure the stock price. Our API captures every such filing, extracts the dilution size, pricing terms, and purpose of fundraising, and scores the potential market impact. Historically, poorly structured CB issuances in Korea have been among the most reliable bearish signals in the market.',

  features: [
    {
      icon: 'db',
      title: 'Dilution Type Classification',
      body: 'Every filing is classified into rights offering, CB, BW, or private placement. Understand the exact mechanism of dilution before trading.',
    },
    {
      icon: 'trending',
      title: 'Quantified Dilution Impact',
      body: 'AI extracts issuance size, conversion price, and dilution percentage relative to current float — structured fields ready for your model.',
    },
    {
      icon: 'zap',
      title: 'Historical Reaction Patterns',
      body: 'Aggregate return statistics for each dilution subtype show average 5-day and 20-day market reactions based on 15+ years of Korean market data.',
    },
  ],

  steps: [
    {
      num: '1',
      title: 'Filing Published',
      body: 'Company files new share / CB / BW issuance decision to DART.',
    },
    {
      num: '2',
      title: 'Terms Extracted',
      body: 'AI parses issuance size, price, conversion terms, and use of proceeds.',
    },
    {
      num: '3',
      title: 'Impact Scored',
      body: 'Dilution percentage and sentiment scored on a 0–100 scale.',
    },
    {
      num: '4',
      title: 'API Available',
      body: 'Structured result available via /v1/events?event_type=DILUTION within ~15 min.',
    },
  ],

  tableTitle: 'Live Dilution Filing Output',
  tableHeaders: ['Company', 'Date', 'Type', 'Impact Score', 'Signal'],
  tableRows: [], // runtime에 실데이터로 교체됨 (Dilution % — deprecated, hidden)

  useCases: [
    {
      title: 'Short Sellers & Risk Managers',
      body: 'Dilution events are among the most reliably bearish signals in Korean small caps. Get structured data to identify high-risk issuances before they impact price.',
    },
    {
      title: 'Portfolio Monitoring Systems',
      body: 'Receive structured alerts when any holding files a dilutive instrument. Filter by dilution percentage threshold to focus on material events.',
    },
    {
      title: 'Compliance & Due Diligence',
      body: 'Track CB and BW issuance history for companies under review. Full historical filing data available for due diligence workflows.',
    },
  ],
};

export default async function KoreaDilutionFilingsPage() {
  const tableRows = await fetchEventTableRows('DILUTION', 5);
  return <EventLandingPage cfg={{ ...cfg, tableRows }} />;
}
