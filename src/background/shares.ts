import type { SendSharesArgs, SendSharesResult, Share } from '../shared/types';
import { VIDEO_ID_PATTERN } from '../shared/video';
import { isUnwatched, refreshCounts } from './counts';
import { supabase } from './supabase';

const NOTE_MAX = 140;
const PROFILE_COLUMNS = 'id, handle, display_name, avatar_url';
const SHARE_COLUMNS = 'id, video_id, title, channel, start_seconds, note, created_at';
/** No paging yet; plenty for a private circle. */
const LIST_LIMIT = 200;

interface VideoMeta {
  title: string | null;
  channel: string | null;
}

/** Title and channel via oEmbed. Missing metadata never blocks a send (oEmbed 401s on unembeddable videos). */
async function videoMeta(videoId: string): Promise<VideoMeta> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
    if (!response.ok) return { title: null, channel: null };
    const data = (await response.json()) as { title?: string; author_name?: string };
    return { title: data.title ?? null, channel: data.author_name ?? null };
  } catch {
    return { title: null, channel: null };
  }
}

async function userId(): Promise<string> {
  const { data: { session } } = await supabase().auth.getSession();
  if (!session) throw new Error('Not signed in');
  return session.user.id;
}

export async function getSentTo(videoId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from('shares')
    .select('recipient_id')
    .eq('sender_id', await userId())
    .eq('video_id', videoId);
  if (error) throw error;
  return data.map((row) => row.recipient_id as string);
}

export async function sendShares({ videoId, recipients, note, startSeconds }: SendSharesArgs): Promise<SendSharesResult> {
  if (!VIDEO_ID_PATTERN.test(videoId)) throw new Error('That isn’t a YouTube video');
  if (!recipients.length) throw new Error('Pick at least one friend');
  const trimmed = note?.trim() || null;
  if (trimmed && trimmed.length > NOTE_MAX) throw new Error(`Notes are at most ${NOTE_MAX} characters`);
  const start = startSeconds && startSeconds > 0 ? Math.floor(startSeconds) : null;

  await userId();
  const { title, channel } = await videoMeta(videoId);
  const client = supabase();
  const results = await Promise.all(
    [...new Set(recipients)].map(async (recipient_id) => {
      const { error } = await client.from('shares').insert({
        recipient_id,
        video_id: videoId,
        title,
        channel,
        start_seconds: start,
        note: trimmed,
      });
      return { recipient_id, error };
    }),
  );

  const failed = results.find((r) => r.error && r.error.code !== '23505');
  if (failed?.error) {
    // RLS rejects Shares to anyone who isn't (or is no longer) a Friend.
    throw failed.error.code === '42501' ? new Error('You can only send to friends') : failed.error;
  }
  return {
    sent: results.filter((r) => !r.error).map((r) => r.recipient_id),
    alreadySent: results.filter((r) => r.error).map((r) => r.recipient_id),
  };
}

export async function getInbox(): Promise<Share[]> {
  const { data, error } = await supabase()
    .from('shares')
    .select(`${SHARE_COLUMNS}, watched_at, user:profiles!shares_sender_id_fkey(${PROFILE_COLUMNS})`)
    .eq('recipient_id', await userId())
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return data as unknown as Share[];
}

export async function getSent(): Promise<Share[]> {
  // watched_at is readable by the sender under RLS, but Iris has no read receipts, so never fetch it.
  const { data, error } = await supabase()
    .from('shares')
    .select(`${SHARE_COLUMNS}, user:profiles!shares_recipient_id_fkey(${PROFILE_COLUMNS})`)
    .eq('sender_id', await userId())
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return (data as unknown as Omit<Share, 'watched_at'>[]).map((share) => ({ ...share, watched_at: null }));
}

export async function unsendShare(id: string): Promise<null> {
  const { data, error } = await supabase().from('shares').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('That Share is already gone');
  return null;
}

/** Only videos with an unwatched Share reach Supabase, so it never learns the rest of your history. */
export async function markWatched(videoId: string): Promise<number> {
  if (!VIDEO_ID_PATTERN.test(videoId)) return 0;
  await refreshCounts();
  if (!isUnwatched(videoId)) return 0;
  const { data, error } = await supabase().rpc('mark_watched', { vid: videoId });
  if (error) throw error;
  await refreshCounts();
  return data as number;
}
