/**
 * Live view count, age, duration and live state for Share cards, read from the video's watch page
 * (no API key) and cached in storage.local for a few hours, so re-renders and reloads don't refetch.
 */
import type { VideoStats } from '../shared/types';
import { VIDEO_ID_PATTERN } from '../shared/video';

const KEY_PREFIX = 'stats:';
const TTL_MS = 3 * 60 * 60 * 1000;
const MAX_IN_FLIGHT = 4;
const PLAYER_RESPONSE = 'ytInitialPlayerResponse = {';

interface Cached {
  stats: VideoStats | null;
  at: number;
}

interface PlayerResponse {
  playabilityStatus?: { status?: string };
  videoDetails?: { viewCount?: string; lengthSeconds?: string; isLiveContent?: boolean; isUpcoming?: boolean };
  microformat?: {
    playerMicroformatRenderer?: {
      publishDate?: string;
      uploadDate?: string;
      liveBroadcastDetails?: { isLiveNow?: boolean; startTimestamp?: string };
    };
  };
}

const pending = new Map<string, Promise<VideoStats | null>>();
let inFlight = 0;
const waiting: (() => void)[] = [];

/** A free slot passes straight to the next waiter, so a newcomer can't slip in between. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

/** The object literal after the marker, sliced by brace depth outside strings; a regex would stop at the first `};` inside one. */
function playerResponse(html: string): PlayerResponse | null {
  const start = html.indexOf(PLAYER_RESPONSE);
  if (start < 0) return null;
  const open = start + PLAYER_RESPONSE.length - 1;
  let depth = 0;
  let inString = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(open, i + 1)) as PlayerResponse;
  }
  return null;
}

function toStats({ playabilityStatus, videoDetails, microformat }: PlayerResponse): VideoStats | null {
  const status = playabilityStatus?.status;
  const upcoming = !!videoDetails?.isUpcoming;
  if (!videoDetails || (status !== 'OK' && !(upcoming && status === 'LIVE_STREAM_OFFLINE'))) return null;
  const micro = microformat?.playerMicroformatRenderer;
  const broadcast = micro?.liveBroadcastDetails;
  const state = upcoming ? 'upcoming' : broadcast?.isLiveNow ? 'live' : videoDetails.isLiveContent ? 'streamed' : 'video';
  return {
    views: Number(videoDetails.viewCount) || 0,
    published: (state === 'streamed' ? broadcast?.startTimestamp : null) ?? micro?.publishDate ?? micro?.uploadDate ?? null,
    lengthSeconds: Number(videoDetails.lengthSeconds) || 0,
    state,
    startsAt: upcoming ? broadcast?.startTimestamp ?? null : null,
  };
}

/** Undefined when the page couldn't be read (network, rate limit, consent wall), so nothing is cached. */
async function fetchStats(videoId: string): Promise<VideoStats | null | undefined> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    if (!response.ok) return undefined;
    const player = playerResponse(await response.text());
    return player ? toStats(player) : undefined;
  } catch {
    return undefined;
  }
}

async function load(videoId: string): Promise<VideoStats | null> {
  const key = KEY_PREFIX + videoId;
  const { [key]: cached } = (await browser.storage.local.get(key)) as Record<string, Cached | undefined>;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.stats;
  const stats = await limited(() => fetchStats(videoId));
  if (stats === undefined) return null;
  await browser.storage.local.set({ [key]: { stats, at: Date.now() } satisfies Cached });
  return stats;
}

/** Null results are cached too, so dead videos aren't refetched on every render. */
export function getVideoStats(videoId: string): Promise<VideoStats | null> {
  if (!VIDEO_ID_PATTERN.test(videoId)) return Promise.resolve(null);
  let promise = pending.get(videoId);
  if (!promise) {
    promise = load(videoId).finally(() => pending.delete(videoId));
    pending.set(videoId, promise);
  }
  return promise;
}

export async function pruneStats(): Promise<void> {
  const all = (await browser.storage.local.get(null)) as Record<string, unknown>;
  const expired = Object.entries(all)
    .filter(([key, value]) => key.startsWith(KEY_PREFIX) && !(Date.now() - (value as Cached).at < TTL_MS))
    .map(([key]) => key);
  if (expired.length) await browser.storage.local.remove(expired);
}
