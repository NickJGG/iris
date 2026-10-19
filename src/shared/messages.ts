/**
 * Typed request/response protocol between content/UI scripts and the background script,
 * which is the sole owner of the Supabase session.
 */
import type { AuthState, HandleCheck, Profile } from './types';

export interface Requests {
  signIn: { args: Record<string, never>; result: AuthState };
  signOut: { args: Record<string, never>; result: null };
  getAuthState: { args: Record<string, never>; result: AuthState };
  checkHandle: { args: { handle: string }; result: HandleCheck };
  claimHandle: { args: { handle: string }; result: Profile };
}

export type RequestType = keyof Requests;

export type RequestMessage = {
  [K in RequestType]: { type: K } & Requests[K]['args'];
}[RequestType];

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };

export async function request<K extends RequestType>(
  type: K,
  ...[args]: Requests[K]['args'] extends Record<string, never> ? [] : [Requests[K]['args']]
): Promise<Requests[K]['result']> {
  const response: Response<Requests[K]['result']> = await browser.runtime.sendMessage({ type, ...args });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
