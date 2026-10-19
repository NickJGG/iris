/**
 * The "Iris" entry in YouTube's left guide, after Subscriptions in the first section. YouTube
 * re-renders the guide freely (and only builds it once the drawer first opens on narrow windows),
 * so a document observer puts the entry back whenever it goes missing.
 */
import { eyeIcon, h } from '../ui/dom';
import { FEED_PATH, isFeedRoute } from './route';

const badge = h('span', { class: 'iris-count', hidden: true });
const entry = h('a', { class: 'iris-guide-entry', href: FEED_PATH, title: 'Iris' },
  eyeIcon(),
  h('span', { class: 'iris-guide-label' }, 'Iris'),
  badge,
);

function insert(): void {
  const items = document.querySelector('ytd-guide-renderer #sections ytd-guide-section-renderer #items');
  if (!items) return;
  const subscriptions = items.querySelector('a[href="/feed/subscriptions"]')?.closest('ytd-guide-entry-renderer');
  if (subscriptions?.parentElement === items) subscriptions.after(entry);
  else items.append(entry);
  updateActive();
}

export function updateActive(): void {
  if (isFeedRoute()) entry.setAttribute('aria-current', 'page');
  else entry.removeAttribute('aria-current');
}

/** Unwatched Share count; 0 hides the badge. */
export function setGuideBadge(count: number): void {
  badge.textContent = String(count);
  badge.hidden = count <= 0;
}

export function startGuide(): void {
  let scheduled = false;
  const check = () => {
    scheduled = false;
    if (!entry.isConnected) insert();
  };
  new MutationObserver(() => {
    if (entry.isConnected || scheduled) return;
    scheduled = true;
    requestAnimationFrame(check);
  }).observe(document.documentElement, { childList: true, subtree: true });
  check();
}
