/**
 * ExternalDataNotice
 * ==================
 * Displays a standard disclaimer about external public-data dependencies.
 *
 * Usage:
 *   <ExternalDataNotice />                          // default (compact)
 *   <ExternalDataNotice variant="banner" />         // yellow warning (e.g. during outage)
 *   <ExternalDataNotice lastUpdated="2026-05-13 14:20 KST" />
 */

interface ExternalDataNoticeProps {
  /** Visual style. "compact" = small footer note; "banner" = amber warning bar */
  variant?: 'compact' | 'banner';
  /** Optional: last successful data refresh timestamp */
  lastUpdated?: string;
  className?: string;
}

const SOURCES = [
  { name: 'DART (FSS)', url: 'https://dart.fss.or.kr' },
  { name: 'data.go.kr', url: 'https://www.data.go.kr' },
  { name: 'ECOS (BOK)', url: 'https://ecos.bok.or.kr' },
  { name: 'MOTIE', url: 'https://www.motie.go.kr' },
];

export default function ExternalDataNotice({
  variant = 'compact',
  lastUpdated,
  className = '',
}: ExternalDataNoticeProps) {

  if (variant === 'banner') {
    return (
      <div className={`flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm ${className}`}>
        {/* Warning icon */}
        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="text-amber-300 leading-relaxed">
          <span className="font-semibold">External data source temporarily unavailable.</span>{' '}
          Some market or disclosure data may be delayed or incomplete.
          We are displaying the most recent available data.
          {lastUpdated && (
            <span className="ml-2 text-amber-400/80 text-xs">Last updated: {lastUpdated}</span>
          )}
        </div>
      </div>
    );
  }

  /* compact (default) */
  return (
    <div className={`flex flex-wrap items-start gap-x-1.5 gap-y-1 text-xs text-gray-600 ${className}`}>
      {/* Info icon */}
      <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        Market and disclosure data are sourced from external public APIs (
        {SOURCES.map((s, i) => (
          <span key={s.name}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 underline underline-offset-2 transition-colors"
            >
              {s.name}
            </a>
            {i < SOURCES.length - 1 && ', '}
          </span>
        ))}
        ).{' '}
        Temporary delays or interruptions may occur during scheduled maintenance periods.
        {lastUpdated && (
          <span className="ml-1 text-gray-700">Last updated: {lastUpdated}.</span>
        )}
      </span>
    </div>
  );
}
