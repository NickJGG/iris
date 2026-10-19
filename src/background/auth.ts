import { HANDLE_PATTERN, type AuthState, type HandleCheck, type Profile } from '../shared/types';
import { supabase } from './supabase';

const PROFILE_COLUMNS = 'id, handle, display_name, avatar_url';

export async function signIn(): Promise<AuthState> {
  const redirectTo = browser.identity.getRedirectURL();
  const url = `${__SUPABASE_URL__}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  const client = supabase();
  const responseUrl = new URL(await browser.identity.launchWebAuthFlow({ url, interactive: true }));

  // Implicit flow returns tokens in the fragment; Supabase reports errors in either part.
  const params = new URLSearchParams(responseUrl.hash.slice(1));
  const error =
    params.get('error_description') ?? params.get('error') ??
    responseUrl.searchParams.get('error_description') ?? responseUrl.searchParams.get('error');
  if (error) throw new Error(error);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Sign-in returned no session');

  const { error: sessionError } = await client.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
  return getAuthState();
}

export async function signOut(): Promise<null> {
  const { error } = await supabase().auth.signOut();
  if (error) throw error;
  return null;
}

export async function getAuthState(): Promise<AuthState> {
  const client = supabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) return { signedIn: false };

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', session.user.id)
    .maybeSingle<Profile>();
  if (error) throw error;
  return {
    signedIn: true,
    profile: data ?? { id: session.user.id, handle: null, display_name: null, avatar_url: null },
  };
}

export async function checkHandle(handle: string): Promise<HandleCheck> {
  const normalized = handle.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(normalized)) return { available: false, reason: 'invalid' };

  const { data, error } = await supabase().rpc('handle_available', { h: normalized });
  if (error) throw error;
  return data ? { available: true } : { available: false, reason: 'taken' };
}

export async function claimHandle(handle: string): Promise<Profile> {
  const normalized = handle.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(normalized)) throw new Error('Handles are 3–20 characters: a–z, 0–9 and _');

  const { data, error } = await supabase()
    .rpc('claim_handle', { h: normalized })
    .select(PROFILE_COLUMNS)
    .single<Profile>();
  if (error?.code === '23505') throw new Error('That handle is taken');
  if (error) throw error;
  return data;
}
