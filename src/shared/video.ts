export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** The video id in a youtube.com/watch?v= or youtu.be/ link, else null. */
export function videoIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const id =
    parsed.hostname === 'youtu.be' ? parsed.pathname.slice(1)
    : /(^|\.)youtube\.com$/.test(parsed.hostname) && parsed.pathname === '/watch' ? parsed.searchParams.get('v')
    : null;
  return id && VIDEO_ID_PATTERN.test(id) ? id : null;
}

/** 250 → "4:10", 3725 → "1:02:05". */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Inverse of formatTime; also takes bare seconds. Null when malformed. */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  if (parts.slice(1).some((p) => p.length !== 2 || Number(p) >= 60)) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

/** Each unit's size in the one before it, starting from minutes. */
const STEPS = [60, 24, 7, 52 / 12, 12];
const UNITS: [short: string, long: string][] = [
  ['m', 'minute'], ['h', 'hour'], ['d', 'day'], ['w', 'week'], ['mo', 'month'], ['y', 'year'],
];

/** Whole units elapsed and the unit's index in UNITS, or null under a minute. */
function elapsed(iso: string, now: number): [number, number] | null {
  let value = (now - Date.parse(iso)) / 60_000;
  if (!(value >= 1)) return null;
  let unit = 0;
  while (unit < STEPS.length && value >= STEPS[unit]) value /= STEPS[unit++];
  return [Math.floor(value), unit];
}

/** "just now", "5m ago", "2h ago", "3d ago", "2w ago", "4mo ago", "1y ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const age = elapsed(iso, now);
  return age ? `${age[0]}${UNITS[age[1]][0]} ago` : 'just now';
}

/** YouTube's form: "1 day ago", "14 hours ago", "3 weeks ago". */
export function timeAgoLong(iso: string, now = Date.now()): string {
  const age = elapsed(iso, now);
  if (!age) return 'just now';
  const [value, unit] = age;
  return `${value} ${UNITS[unit][1]}${value === 1 ? '' : 's'} ago`;
}

const COMPACT = new Intl.NumberFormat('en', { notation: 'compact' });

/** "No views", "1 view", "412K views", "1.2M views". */
export function formatViews(n: number): string {
  return n === 0 ? 'No views' : n === 1 ? '1 view' : `${COMPACT.format(n)} views`;
}
