/**
 * The "Iris" entry in YouTube's left guide, after Subscriptions in the first section. YouTube
 * re-renders the guide freely (and only builds it once the drawer first opens on narrow windows),
 * so a document observer puts the entry back whenever it goes missing.
 */
import type { Counts } from '../shared/types';
import { eyeIcon, h } from '../ui/dom';
import { FEED_HREF, isFeedRoute } from './route';

const dot = h('span', { class: 'iris-dot', role: 'img', hidden: true });
const entry = h('a', { class: 'iris-guide-entry', href: FEED_HREF, title: 'Iris' },
  eyeIcon(),
  h('span', { class: 'iris-guide-label' }, 'Iris'),
  dot,
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

/** YouTube's subscription newness dot, on while anything is New. */
export function setGuideDot(counts: Counts): void {
  const label = [counts.shares > 0 && 'New Shares', counts.requests > 0 && 'New friend requests'].filter(Boolean).join(', ');
  dot.hidden = !label;
  dot.setAttribute('aria-label', label);
  entry.title = label ? `Iris · ${label}` : 'Iris';
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
