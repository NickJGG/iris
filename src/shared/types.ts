export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface Profile {
  id: string;
  /** Null until the User picks one on first run. */
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export type AuthState = { signedIn: false } | { signedIn: true; profile: Profile };

export type HandleCheck = { available: true } | { available: false; reason: 'invalid' | 'taken' };

/** A pending Friend request; `user` is the other side (the requester when incoming, the target when outgoing). */
export interface FriendRequest {
  id: string;
  created_at: string;
  user: Profile;
}

export interface FriendsState {
  incoming: FriendRequest[];
  /** Never reveals whether the target declined. */
  outgoing: FriendRequest[];
  friends: Profile[];
}

export interface SendSharesArgs {
  videoId: string;
  /** Friend ids; each gets their own Share. */
  recipients: string[];
  note: string | null;
  startSeconds: number | null;
}

export interface SendSharesResult {
  sent: string[];
  /** Recipients who already had this video from you (the unique constraint). */
  alreadySent: string[];
}

/** A Share as one side sees it; `user` is the other side (the sender in the Inbox, the recipient in Sent). */
export interface Share {
  id: string;
  video_id: string;
  /** Null when oEmbed had no metadata (private or unembeddable videos). */
  title: string | null;
  channel: string | null;
  channel_avatar: string | null;
  start_seconds: number | null;
  note: string | null;
  created_at: string;
  /** Always null in Sent: senders get no watched receipt. */
  watched_at: string | null;
  user: Profile;
}

export interface Counts {
  /** Unwatched Shares in the Inbox. */
  unwatched: number;
  /** Incoming Friend requests. */
  requests: number;
}

/** Live facts about a video from its watch page; null when unavailable. */
export interface VideoStats {
  views: number;
  /** ISO; upload, or a stream's start. */
  published: string | null;
  lengthSeconds: number;
  state: 'video' | 'live' | 'upcoming' | 'streamed';
  /** Upcoming only. */
  startsAt: string | null;
}
