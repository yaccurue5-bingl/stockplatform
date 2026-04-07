/**
 * DataSourceNote — inline source attribution badge for government data panels.
 *
 * Legal rationale:
 *  - DART (금융감독원 전자공시시스템): open API, attribution required per FSS terms.
 *  - MOTIE (산업통상자원부) / MOEF (기획재정부): public data (공공데이터포털),
 *    free use with source attribution under the Korean Government Open Data Law
 *    (공공데이터의 제공 및 이용 활성화에 관한 법률 제26조).
 *  - All content shown is AI-processed analysis, NOT a verbatim reproduction
 *    of the original government document.
 */

type Source = 'DART' | 'MOTIE' | 'MOFE';

interface DataSourceNoteProps {
  source: Source;
  reportName?: string;
  reportDate?: string;
  className?: string;
}

const SOURCE_META: Record<Source, { label: string; org: string; orgKr: string; url: string }> = {
  DART: {
    label: 'Disclosure filing',
    org: 'Financial Supervisory Service',
    orgKr: '금융감독원 전자공시시스템',
    url: 'https://dart.fss.or.kr',
  },
  MOTIE: {
    label: 'Export/Import trend report',
    org: 'Ministry of Trade, Industry and Energy',
    orgKr: '산업통상자원부',
    url: 'https://www.motie.go.kr',
  },
  MOFE: {
    label: 'Daily economic indicators report',
    org: 'Ministry of Economy and Finance',
    orgKr: '기획재정부',
    url: 'https://www.moef.go.kr',
  },
};

export default function DataSourceNote({
  source,
  reportName,
  reportDate,
  className = '',
}: DataSourceNoteProps) {
  const meta = SOURCE_META[source];

  return (
    <div className={`flex items-start gap-2 text-xs text-gray-600 bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 ${className}`}>
      {/* Icon */}
      <svg
        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <div className="leading-relaxed">
        <span className="text-gray-500">
          AI-processed analysis.{' '}
          {reportName && <span>Based on: <em>{reportName}</em>. </span>}
          {reportDate && <span>({reportDate}) </span>}
          Source:{' '}
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-500 transition"
          >
            {meta.org} ({meta.orgKr})
          </a>
          . Raw government data is not redistributed.
          Not investment advice.
        </span>
      </div>
    </div>
  );
}
