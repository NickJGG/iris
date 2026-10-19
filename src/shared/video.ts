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
