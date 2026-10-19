import type { EventMessage, IrisEvent } from '../shared/messages';

/** Sends an event to every extension page (feed.html) and YouTube tab. */
export async function broadcast(event: IrisEvent): Promise<void> {
  const message: EventMessage = { event };
  // Rejects when no extension page (feed.html) is open to receive it.
  browser.runtime.sendMessage(message).catch(() => {});
  const tabs = await browser.tabs.query({ url: 'https://www.youtube.com/*' });
  for (const tab of tabs) {
    if (tab.id !== undefined) browser.tabs.sendMessage(tab.id, message).catch(() => {});
  }
}
