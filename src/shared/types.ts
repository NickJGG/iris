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
