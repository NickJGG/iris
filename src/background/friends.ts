import type { FriendRequest, FriendsState, Profile } from '../shared/types';
import { supabase } from './supabase';

const PROFILE_COLUMNS = 'id, handle, display_name, avatar_url';

interface OutgoingRow {
  id: string;
  to_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function getFriends(): Promise<FriendsState> {
  const client = supabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const me = session.user.id;

  const [incoming, outgoing, friendships] = await Promise.all([
    // RLS returns only requests to you that you haven't declined.
    client
      .from('friend_requests')
      .select(`id, created_at, user:profiles!friend_requests_from_id_fkey(${PROFILE_COLUMNS})`)
      .order('created_at', { ascending: false }),
    client.rpc('outgoing_requests'),
    client
      .from('friendships')
      .select(`a:profiles!friendships_user_a_fkey(${PROFILE_COLUMNS}), b:profiles!friendships_user_b_fkey(${PROFILE_COLUMNS})`),
  ]);
  if (incoming.error) throw incoming.error;
  if (outgoing.error) throw outgoing.error;
  if (friendships.error) throw friendships.error;

  const pairs = friendships.data as unknown as { a: Profile; b: Profile }[];
  return {
    incoming: incoming.data as unknown as FriendRequest[],
    outgoing: (outgoing.data as OutgoingRow[]).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user: { id: row.to_id, handle: row.handle, display_name: row.display_name, avatar_url: row.avatar_url },
    })),
    friends: pairs
      .map(({ a, b }) => (a.id === me ? b : a))
      .sort((x, y) => (x.handle ?? '').localeCompare(y.handle ?? '')),
  };
}

async function call(fn: string, args: Record<string, string>): Promise<null> {
  const { error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return null;
}

export function sendFriendRequest(handle: string): Promise<null> {
  return call('send_friend_request', { target_handle: handle.trim().replace(/^@/, '').toLowerCase() });
}

export const acceptRequest = (id: string) => call('accept_request', { request_id: id });
export const declineRequest = (id: string) => call('decline_request', { request_id: id });
export const cancelRequest = (id: string) => call('cancel_request', { request_id: id });
export const removeFriend = (id: string) => call('remove_friend', { friend_id: id });
