/**
 * Mounts the Feed at youtube.com/feed/you?iris. It rides on a real page because YouTube's
 * "page isn't available" page leaves the masthead's logo, avatar and bell out. We hide the page's
 * own content inside ytd-page-manager and render the Feed in its place, keeping YouTube's
 * masthead, guide and theme. If the page manager never appears, the tab falls back to feed.html.
 *
 * YouTube strips the ?iris marker with a replaceState we can't intercept (its scripts hold their
 * own copy), so early.ts flags the route before it's gone, and while mounted we put it back.
 */
import { request } from '../shared/messages';
import { mountFeed } from '../ui/feed';
import { FEED_FLAG, FEED_HREF, FEED_PATH, hasFeedMarker } from './feed-url';

export { FEED_HREF };

const MOUNT_TIMEOUT_MS = 8000;
const MARKER_CHECK_MS = 250;

let host: HTMLElement | null = null;
let unmountFeed: (() => void) | null = null;
let keepAttached: MutationObserver | null = null;
let keepMarker: ReturnType<typeof setInterval> | undefined;
let attempt = 0;

export const isFeedRoute = () =>
  location.pathname.replace(/\/$/, '') === FEED_PATH &&
  (hasFeedMarker() || document.documentElement.hasAttribute(FEED_FLAG));

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

  keepMarker = setInterval(() => {
    if (!hasFeedMarker()) history.replaceState(history.state, '', FEED_HREF + location.hash);
  }, MARKER_CHECK_MS);
}

export function unmount(): void {
  attempt++;
  if (host) document.documentElement.removeAttribute(FEED_FLAG);
  clearInterval(keepMarker);
  keepAttached?.disconnect();
  keepAttached = null;
  unmountFeed?.();
  unmountFeed = null;
  host?.remove();
  host = null;
  document.querySelector('ytd-page-manager[iris-route]')?.removeAttribute('iris-route');
}

/**
 * A navigation has started. Like YouTube with its own pages, the Feed stays up until the next page
 * is ready; it just stops holding the route, so syncRoute unmounts it once the navigation finishes.
 */
export function leaveRoute(): void {
  if (!host) return unmount();
  document.documentElement.removeAttribute(FEED_FLAG);
  clearInterval(keepMarker);
}

export function syncRoute(): void {
  if (isFeedRoute()) void mount();
  else unmount();
}
