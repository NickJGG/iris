/**
 * Mounts the Feed at youtube.com/feed/iris. YouTube serves its "page isn't available" page there;
 * we hide that inside ytd-page-manager and render the Feed in its place, keeping YouTube's
 * masthead, guide and theme. If the page manager never appears, the tab falls back to feed.html.
 */
import { request } from '../shared/messages';
import { mountFeed } from '../ui/feed';

export const FEED_PATH = '/feed/iris';
const MOUNT_TIMEOUT_MS = 8000;

let host: HTMLElement | null = null;
let unmountFeed: (() => void) | null = null;
let keepAttached: MutationObserver | null = null;
let attempt = 0;

export const isFeedRoute = () => location.pathname.replace(/\/$/, '') === FEED_PATH;

/** The video on a /watch page, else null. */
export const watchVideoId = () => (location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null);

function waitFor(selector: string, timeoutMs: number): Promise<Element | null> {
  const found = document.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) finish(el);
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    const finish = (el: Element | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function mount(): Promise<void> {
  if (host?.isConnected) return;
  const current = ++attempt;
  const pageManager = await waitFor('ytd-page-manager', MOUNT_TIMEOUT_MS);
  if (current !== attempt || !isFeedRoute()) return;
  if (!pageManager) {
    await request('openFeedPage');
    return;
  }

  host = document.createElement('div');
  host.className = 'iris-host iris-root';
  pageManager.setAttribute('iris-route', '');
  pageManager.append(host);
  unmountFeed = mountFeed(host);
  document.title = 'Iris - YouTube';

  // YouTube may rebuild the page manager's children after we've mounted.
  keepAttached = new MutationObserver(() => {
    if (host && !host.isConnected) pageManager.append(host);
  });
  keepAttached.observe(pageManager, { childList: true });
}

export function unmount(): void {
  attempt++;
  keepAttached?.disconnect();
  keepAttached = null;
  unmountFeed?.();
  unmountFeed = null;
  host?.remove();
  host = null;
  document.querySelector('ytd-page-manager[iris-route]')?.removeAttribute('iris-route');
}

export function syncRoute(): void {
  if (isFeedRoute()) void mount();
  else unmount();
}
