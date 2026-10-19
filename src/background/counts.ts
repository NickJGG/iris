/**
 * New counts: unwatched Shares and incoming requests that arrived after their seen mark (when you
 * last viewed the Inbox or Friends tab; no mark means never). Pushed to the toolbar badge and (as a
 * `counts` event) to the guide dot, Feed and shelf. Firefox suspends the event page when idle, so
 * realtime only helps while it's awake; a one-minute alarm is what guarantees freshness.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Counts, SeenKind } from '../shared/types';
import { broadcast } from './broadcast';
import { supabase } from './supabase';

const ALARM = 'iris-refresh';
const SIGNATURE_KEY = 'countsSignature';
const NOTIFICATION_RED = '#cc0000';

let unwatchedVideos = new Set<string>();
let channel: RealtimeChannel | null = null;
let channelUser: string | null = null;
let debounce: ReturnType<typeof setTimeout> | undefined;

/** As of the last refresh. */
export const isUnwatched = (videoId: string) => unwatchedVideos.has(videoId);

export async function refreshCounts(): Promise<Counts> {
  const client = supabase();
  const { data: { session } } = await client.auth.getSession();
  let counts: Counts = { shares: 0, requests: 0 };
  let signature = '';

  if (!session) {
    unwatchedVideos = new Set();
    stopRealtime();
  } else {
    const [shares, requests, marks] = await Promise.all([
      client.from('shares').select('id, video_id, created_at').eq('recipient_id', session.user.id).is('watched_at', null),
      // RLS returns only requests to you that you haven't declined.
      client.from('friend_requests').select('id, created_at'),
      client.from('seen_marks').select('shares_seen_at, requests_seen_at').eq('user_id', session.user.id).maybeSingle(),
    ]);
    if (shares.error) throw shares.error;
    if (requests.error) throw requests.error;
    if (marks.error) throw marks.error;
    unwatchedVideos = new Set(shares.data.map((s) => s.video_id as string));
    const sharesSeen = marks.data?.shares_seen_at ?? null;
    const requestsSeen = marks.data?.requests_seen_at ?? null;
    counts = {
      shares: shares.data.filter((s) => isNewer(s.created_at, sharesSeen)).length,
      requests: requests.data.filter((r) => isNewer(r.created_at, requestsSeen)).length,
    };
    // The marks are in it so that marking seen broadcasts even when no rows changed.
    signature = [...shares.data.map((s) => s.id), '|', ...requests.data.map((r) => r.id)].sort().join()
      + `|${sharesSeen}|${requestsSeen}`;
    startRealtime(session.user.id);
  }

  const total = counts.shares + counts.requests;
  void browser.action.setBadgeText({ text: total > 99 ? '99+' : total ? String(total) : '' });
  // Kept in session storage, not a variable, so an event page waking up doesn't re-announce unchanged counts.
  const { [SIGNATURE_KEY]: previous } = await browser.storage.session.get(SIGNATURE_KEY);
  if (previous !== signature) {
    await browser.storage.session.set({ [SIGNATURE_KEY]: signature });
    void broadcast({ type: 'counts', counts });
  }
  return counts;
}

export const isNewer = (createdAt: string, seenAt: string | null) => !seenAt || Date.parse(createdAt) > Date.parse(seenAt);

export async function markSeen(kind: SeenKind): Promise<null> {
  const { error } = await supabase().rpc('mark_seen', { kind });
  if (error) throw error;
  await refreshCounts();
  return null;
}

function scheduleRefresh(): void {
  clearTimeout(debounce);
  debounce = setTimeout(() => void refreshCounts().catch(() => {}), 500);
}

function startRealtime(userId: string): void {
  if (channel && channelUser === userId) return;
  stopRealtime();
  channelUser = userId;
  // Deletes (Unsend) can't be filtered, so they arrive with the next alarm instead.
  channel = supabase()
    .channel(`iris-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shares', filter: `recipient_id=eq.${userId}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `to_id=eq.${userId}` }, scheduleRefresh)
    .subscribe();
}

function stopRealtime(): void {
  if (channel) void supabase().removeChannel(channel);
  channel = channelUser = null;
}

/** Runs on every event-page wake. */
export function startCounts(): void {
  void browser.action.setBadgeBackgroundColor({ color: NOTIFICATION_RED });
  void browser.action.setBadgeTextColor({ color: '#fff' });
  void browser.alarms.get(ALARM).then((alarm) => {
    if (!alarm) void browser.alarms.create(ALARM, { periodInMinutes: 1 });
  });
  browser.alarms.onAlarm.addListener(({ name }) => {
    if (name === ALARM) void refreshCounts().catch(() => {});
  });
  void refreshCounts().catch(() => {});
}
