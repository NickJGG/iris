/**
 * Typed request/response protocol between content/UI scripts and the background script,
 * which is the sole owner of the Supabase session. The background pushes `IrisEvent`s back.
 */
import type { AuthState, FriendsState, HandleCheck, Profile } from './types';

type NoArgs = Record<string, never>;

export interface Requests {
  signIn: { args: NoArgs; result: AuthState };
  signOut: { args: NoArgs; result: null };
  getAuthState: { args: NoArgs; result: AuthState };
  checkHandle: { args: { handle: string }; result: HandleCheck };
  claimHandle: { args: { handle: string }; result: Profile };
  getFriends: { args: NoArgs; result: FriendsState };
  sendFriendRequest: { args: { handle: string }; result: null };
  acceptRequest: { args: { id: string }; result: null };
  declineRequest: { args: { id: string }; result: null };
  cancelRequest: { args: { id: string }; result: null };
  removeFriend: { args: { id: string }; result: null };
  /** Replaces the sender's tab with feed.html, for when the /feed/iris mount can't happen. */
  openFeedPage: { args: NoArgs; result: null };
}

export type RequestType = keyof Requests;

export type RequestMessage = {
  [K in RequestType]: { type: K } & Requests[K]['args'];
}[RequestType];

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };

export async function request<K extends RequestType>(
  type: K,
  ...[args]: Requests[K]['args'] extends NoArgs ? [] : [Requests[K]['args']]
): Promise<Requests[K]['result']> {
  const response: Response<Requests[K]['result']> = await browser.runtime.sendMessage({ type, ...args });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export type IrisEvent = { type: 'authChanged' };

export interface EventMessage {
  event: IrisEvent;
}

export function onEvent(listener: (event: IrisEvent) => void): () => void {
  // Must stay synchronous and return nothing: in feed.html this also sees content-script
  // requests, which only the background may answer.
  const handler = (message: unknown) => {
    const event = (message as Partial<EventMessage> | null)?.event;
    if (event) listener(event);
  };
  browser.runtime.onMessage.addListener(handler);
  return () => browser.runtime.onMessage.removeListener(handler);
}
