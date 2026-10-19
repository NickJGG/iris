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
