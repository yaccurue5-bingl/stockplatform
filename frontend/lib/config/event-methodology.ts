export type EventMethodology = {
  title: string;
  description: string;
  factors: string[];
};

export const EVENT_METHODOLOGY = {
  CONTRACT: {
    title: 'Strategic Contract Evaluation',
    description:
      'Contract events are evaluated by measuring business scale, revenue relevance, counterparty quality, and execution visibility.',
    factors: [
      'Contract size relative to company revenue',
      'Expected revenue impact',
      'Counterparty quality',
      'Contract duration and execution period',
    ],
  },
  DIVIDEND: {
    title: 'Dividend Evaluation',
    description:
      'Dividend events are evaluated by reviewing shareholder return strength, yield, payout consistency, and changes versus prior periods.',
    factors: [
      'Dividend increase or decrease',
      'Dividend yield',
      'Historical consistency',
      'Payout timing and sustainability',
    ],
  },
  BUYBACK: {
    title: 'Share Buyback Evaluation',
    description:
      'Share buyback events are evaluated by assessing capital return size, share supply reduction, execution method, and cancellation intent.',
    factors: [
      'Buyback size relative to market value',
      'Share count impact',
      'Acquisition period and method',
      'Cancellation or retirement plan',
    ],
  },
  DILUTION: {
    title: 'Capital Raise Evaluation',
    description:
      'Capital raise events are evaluated by estimating dilution pressure, funding purpose, pricing terms, and impact on existing shareholders.',
    factors: [
      'Potential dilution rate',
      'Issuance or conversion price',
      'Funding purpose',
      'Shareholder value impact',
    ],
  },
  EARNINGS: {
    title: 'Earnings Evaluation',
    description:
      'Earnings events are evaluated by comparing profitability, growth, margin direction, and one-off factors against market expectations.',
    factors: [
      'Revenue and profit growth',
      'Operating margin direction',
      'Net income quality',
      'One-off gains or losses',
    ],
  },
  EXECUTIVE_CHANGE: {
    title: 'Executive Change Evaluation',
    description:
      'Executive changes are evaluated by considering role importance, appointment or resignation context, and potential governance impact.',
    factors: [
      'Role seniority',
      'Appointment, resignation, or replacement',
      'Governance implications',
      'Continuity of business strategy',
    ],
  },
  MNA: {
    title: 'M&A / Merger Evaluation',
    description:
      'M&A events are evaluated by assessing deal size relative to company scale, strategic rationale, financing structure, and integration risk.',
    factors: [
      'Deal size relative to market value',
      'Strategic fit and synergy potential',
      'Financing structure (cash, stock, debt)',
      'Regulatory and integration risk',
    ],
  },
  LEGAL: {
    title: 'Legal / Regulatory Evaluation',
    description:
      'Legal and regulatory events are evaluated by estimating potential financial exposure, likelihood of adverse outcome, and business disruption.',
    factors: [
      'Potential financial exposure',
      'Likelihood of adverse outcome',
      'Business disruption risk',
      'Precedent and regulatory context',
    ],
  },
  CAPEX: {
    title: 'Capital Investment Evaluation',
    description:
      'Capital investment events are evaluated by measuring investment size relative to company scale, expected return, and funding source.',
    factors: [
      'Investment size relative to company assets',
      'Expected capacity or revenue impact',
      'Funding source and balance sheet impact',
      'Execution timeline',
    ],
  },
  DISPOSAL: {
    title: 'Treasury Share Disposal Evaluation',
    description:
      'Treasury share disposal events are evaluated by assessing supply impact, disposal method, and stated purpose.',
    factors: [
      'Disposal size relative to shares outstanding',
      'Disposal method and timing',
      'Stated purpose (funding, compensation, etc.)',
      'Dilution / supply impact',
    ],
  },
  OTHER: {
    title: 'Corporate Disclosure Evaluation',
    description:
      'General corporate disclosures are evaluated using event-agnostic factors — materiality, financial relevance, and market impact.',
    factors: [
      'Materiality to company operations',
      'Financial relevance',
      'Historical market reaction to similar filings',
      'Disclosure completeness',
    ],
  },
} as const satisfies Record<string, EventMethodology>;

export function getEventMethodology(eventType: string | null | undefined): EventMethodology | null {
  if (!eventType) return null;

  const eventKey = eventType.toUpperCase();
  return EVENT_METHODOLOGY[eventKey as keyof typeof EVENT_METHODOLOGY] ?? null;
}
