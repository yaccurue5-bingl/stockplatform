/**
 * Korean market holiday calendar & trading day utilities
 * Static list — no external API required.
 * Update HOLIDAYS each year.
 */

// KST = UTC+9
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Korean public holidays: 'YYYY-MM-DD' → holiday name */
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-01-28': 'Lunar New Year Holiday',
  '2026-01-29': 'Lunar New Year',
  '2026-01-30': 'Lunar New Year Holiday',
  '2026-03-01': 'Independence Movement Day',
  '2026-05-05': "Children's Day",
  '2026-05-15': "Buddha's Birthday",
  '2026-05-25': "Buddha's Birthday (Substitute)",
  '2026-06-06': 'Memorial Day',
  '2026-08-15': 'Liberation Day',
  '2026-09-24': 'Chuseok Holiday',
  '2026-09-25': 'Chuseok',
  '2026-09-26': 'Chuseok Holiday',
  '2026-10-03': 'National Foundation Day',
  '2026-10-09': 'Hangeul Day',
  '2026-12-25': 'Christmas',
};

const HOLIDAYS_2027: Record<string, string> = {
  '2027-01-01': "New Year's Day",
  '2027-02-16': 'Lunar New Year Holiday',
  '2027-02-17': 'Lunar New Year',
  '2027-02-18': 'Lunar New Year Holiday',
  '2027-03-01': 'Independence Movement Day',
  '2027-05-05': "Children's Day",
  '2027-05-24': "Buddha's Birthday",
  '2027-06-06': 'Memorial Day',
  '2027-08-15': 'Liberation Day',
  '2027-10-03': 'National Foundation Day',
  '2027-10-05': 'Chuseok Holiday',
  '2027-10-06': 'Chuseok',
  '2027-10-07': 'Chuseok Holiday',
  '2027-10-09': 'Hangeul Day',
  '2027-12-25': 'Christmas',
};

const ALL_HOLIDAYS: Record<string, string> = {
  ...HOLIDAYS_2026,
  ...HOLIDAYS_2027,
};

function toKSTDateString(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function toKSTDate(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

export type MarketStatus =
  | { closed: false }
  | { closed: true; reason: string; next: string };

/**
 * Returns current Korean market status based on KST date.
 * next: formatted next trading session date string (e.g. "May 26")
 */
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const kstDate = toKSTDate(now);
  const dateStr = toKSTDateString(now);
  const dow = kstDate.getUTCDay(); // 0=Sun, 6=Sat

  let reason: string | null = null;

  if (dow === 0) reason = 'Weekend';
  else if (dow === 6) reason = 'Weekend';
  else if (ALL_HOLIDAYS[dateStr]) reason = ALL_HOLIDAYS[dateStr];

  if (!reason) return { closed: false };

  // Find next trading session
  const next = nextTradingDay(now);
  return { closed: true, reason, next };
}

function nextTradingDay(from: Date): string {
  const d = new Date(from.getTime() + KST_OFFSET_MS);
  // advance day by day until we find a trading day
  for (let i = 1; i <= 14; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    const str = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !ALL_HOLIDAYS[str]) {
      return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC',
      });
    }
  }
  return 'Next weekday';
}
