import type { RequestMessage, Response } from '../shared/messages';
import { checkHandle, claimHandle, deleteAccount, getAuthState, signIn, signOut } from './auth';
import { broadcast } from './broadcast';
import { markSeen, refreshCounts, startCounts } from './counts';
import { acceptRequest, cancelRequest, declineRequest, getFriends, removeFriend, sendFriendRequest } from './friends';
import { createMenus, onMenuClicked } from './menus';
import { getInbox, getSent, getSentTo, markWatched, sendShares, unsendShare } from './shares';
import { getVideoStats, pruneStats } from './stats';

const FEED_URL = 'https://www.youtube.com/feed/you?iris';

async function changingAuth<T>(action: Promise<T>): Promise<T> {
  const result = await action;
  void broadcast({ type: 'authChanged' });
  void refreshCounts().catch(() => {});
  return result;
}

async function changingRequests<T>(action: Promise<T>): Promise<T> {
  const result = await action;
  void refreshCounts().catch(() => {});
  return result;
}

/** Focuses an open Feed tab in this window, else opens one. */
async function openFeed(): Promise<void> {
  const [tab] = await browser.tabs.query({ url: `${FEED_URL}*`, currentWindow: true });
  if (tab?.id !== undefined) await browser.tabs.update(tab.id, { active: true });
  else await browser.tabs.create({ url: FEED_URL });
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
    case 'deleteAccount':
      return changingAuth(deleteAccount());
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
      return changingRequests(acceptRequest(message.id));
    case 'declineRequest':
      return changingRequests(declineRequest(message.id));
    case 'cancelRequest':
      return cancelRequest(message.id);
    case 'removeFriend':
      return removeFriend(message.id);
    case 'getSentTo':
      return getSentTo(message.videoId);
    case 'sendShares':
      return sendShares(message);
    case 'getInbox':
      return getInbox();
    case 'getSent':
      return getSent();
    case 'unsendShare':
      return unsendShare(message.id);
    case 'markWatched':
      return markWatched(message.videoId);
    case 'getCounts':
      return refreshCounts();
    case 'markSeen':
      return markSeen(message.kind);
    case 'getVideoStats':
      return getVideoStats(message.videoId);
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
  void createMenus();
  void pruneStats();
  if (reason === 'install') void browser.tabs.create({ url: FEED_URL });
});

browser.runtime.onStartup.addListener(() => void pruneStats());
browser.menus.onClicked.addListener(onMenuClicked);
browser.action.onClicked.addListener(() => void openFeed());
startCounts();
