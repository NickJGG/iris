import type { RequestMessage, Response } from '../shared/messages';
import { checkHandle, claimHandle, getAuthState, signIn, signOut } from './auth';

function handle(message: RequestMessage): Promise<unknown> {
  switch (message.type) {
    case 'signIn':
      return signIn();
    case 'signOut':
      return signOut();
    case 'getAuthState':
      return getAuthState();
    case 'checkHandle':
      return checkHandle(message.handle);
    case 'claimHandle':
      return claimHandle(message.handle);
  }
}

browser.runtime.onMessage.addListener(async (message: RequestMessage): Promise<Response<unknown>> => {
  try {
    return { ok: true, data: await handle(message) };
  } catch (error) {
    const text = (error as { message?: unknown } | null)?.message;
    return { ok: false, error: typeof text === 'string' ? text : String(error) };
  }
});
