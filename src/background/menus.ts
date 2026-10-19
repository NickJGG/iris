import type { EventMessage } from '../shared/messages';
import { videoIdFromUrl } from '../shared/video';

const SEND_MENU_ID = 'iris-send';

/** Event-page menus persist across restarts, so this only runs from onInstalled. */
export async function createMenus(): Promise<void> {
  await browser.menus.removeAll();
  browser.menus.create({
    id: SEND_MENU_ID,
    // Firefox shows the extension's icon beside it, so no ◉ in the title.
    title: 'Send with Iris…',
    contexts: ['link'],
    targetUrlPatterns: ['*://www.youtube.com/watch?v=*', '*://youtu.be/*'],
    // The composer lives in the YouTube content script.
    documentUrlPatterns: ['https://www.youtube.com/*'],
  });
}

export function onMenuClicked(info: browser.menus.OnClickData, tab?: browser.tabs.Tab): void {
  const videoId = info.linkUrl ? videoIdFromUrl(info.linkUrl) : null;
  if (info.menuItemId !== SEND_MENU_ID || !videoId || tab?.id === undefined) return;
  const message: EventMessage = { event: { type: 'openComposer', videoId } };
  // Rejects in tabs opened before install, which have no content script yet.
  browser.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => {});
}
