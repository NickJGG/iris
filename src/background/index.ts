import type { EventMessage, IrisEvent, RequestMessage, Response } from '../shared/messages';
import { checkHandle, claimHandle, getAuthState, signIn, signOut } from './auth';
import { acceptRequest, cancelRequest, declineRequest, getFriends, removeFriend, sendFriendRequest } from './friends';

const FEED_URL = 'https://www.youtube.com/feed/iris';

async function broadcast(event: IrisEvent): Promise<void> {
  const message: EventMessage = { event };
  // Rejects when no extension page (feed.html) is open to receive it.
  browser.runtime.sendMessage(message).catch(() => {});
  const tabs = await browser.tabs.query({ url: 'https://www.youtube.com/*' });
  for (const tab of tabs) {
    if (tab.id !== undefined) browser.tabs.sendMessage(tab.id, message).catch(() => {});
  }
}

async function changingAuth<T>(action: Promise<T>): Promise<T> {
  const result = await action;
  void broadcast({ type: 'authChanged' });
  return result;
}

async function openFeedPage(tabId: number | undefined): Promise<null> {
  if (tabId === undefined) throw new Error('No tab to open the Feed in');
  await browser.tabs.update(tabId, { url: browser.runtime.getURL('feed.html') });
  return null;
}

function handle(message: RequestMessage, sender: browser.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'signIn':
      return changingAuth(signIn());
    case 'signOut':
      return changingAuth(signOut());
    case 'getAuthState':
      return getAuthState();
    case 'checkHandle':
      return checkHandle(message.handle);
    case 'claimHandle':
      return changingAuth(claimHandle(message.handle));
    case 'getFriends':
      return getFriends();
    case 'sendFriendRequest':
      return sendFriendRequest(message.handle);
    case 'acceptRequest':
      return acceptRequest(message.id);
    case 'declineRequest':
      return declineRequest(message.id);
    case 'cancelRequest':
      return cancelRequest(message.id);
    case 'removeFriend':
      return removeFriend(message.id);
    case 'openFeedPage':
      return openFeedPage(sender.tab?.id);
  }
}

browser.runtime.onMessage.addListener(
  async (message: RequestMessage, sender: browser.runtime.MessageSender): Promise<Response<unknown>> => {
    try {
      return { ok: true, data: await handle(message, sender) };
    } catch (error) {
      const text = (error as { message?: unknown } | null)?.message;
      return { ok: false, error: typeof text === 'string' ? text : String(error) };
    }
  },
);

browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') void browser.tabs.create({ url: FEED_URL });
});
