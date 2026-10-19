/**
 * The "From friends" shelf atop YouTube home: the latest Shares in pure recency, watched ones
 * dimmed, one row of as many cards as YouTube's own grid fits. Hidden while signed out or with no
 * Shares. YouTube re-renders home freely, so a document observer puts the shelf back when it goes missing.
 */
import { request } from '../shared/messages';
import type { Share } from '../shared/types';
import { eyeIcon, h } from '../ui/dom';
import { shareCard } from '../ui/share-card';
import { FEED_PATH } from './route';

const HOME_GRID = 'ytd-browse[page-subtype="home"]:not([hidden]) ytd-rich-grid-renderer';
const MIN_CARD_WIDTH = 300;
const GAP = 16;

let shares: Share[] = [];
let perRow = 0;

const row = h('div', { class: 'iris-shelf-row' });
const shelf = h('section', { class: 'iris-root iris-shelf', hidden: true, 'aria-label': 'From friends' },
  h('div', { class: 'iris-shelf-head' },
    eyeIcon(),
    h('h2', { class: 'iris-shelf-title' }, 'From friends'),
    h('a', { class: 'iris-link', href: FEED_PATH }, 'See all'),
  ),
  row,
);

const isHome = () => location.pathname === '/';

/** YouTube's column count for its home grid, so the shelf lines up with it. */
function columns(): number {
  const grid = shelf.closest('ytd-rich-grid-renderer');
  const fromYouTube = grid && parseInt(getComputedStyle(grid).getPropertyValue('--ytd-rich-grid-items-per-row'), 10);
  if (fromYouTube && fromYouTube > 0) return fromYouTube;
  return Math.max(1, Math.floor((row.clientWidth + GAP) / (MIN_CARD_WIDTH + GAP)));
}

function render(): void {
  perRow = columns();
  shelf.hidden = !shares.length;
  shelf.style.setProperty('--iris-per-row', String(perRow));
  row.replaceChildren(...shares.slice(0, perRow).map((s) => shareCard(s, 'inbox')));
}

/** Re-fetches the Inbox; signed out (or any error) hides the shelf. */
export async function refreshShelf(): Promise<void> {
  if (!isHome()) return;
  shares = await request('getInbox').catch(() => []);
  render();
}

function insert(): void {
  const grid = document.querySelector(HOME_GRID);
  if (!grid) return;
  // Below the chip bar, above the videos.
  const contents = [...grid.children].find((child) => child.id === 'contents');
  if (contents) contents.before(shelf);
  else grid.prepend(shelf);
  render();
}

export function startShelf(): void {
  let scheduled = false;
  const check = () => {
    scheduled = false;
    if (isHome() && !shelf.isConnected) insert();
  };
  new MutationObserver(() => {
    if (scheduled || shelf.isConnected || !isHome()) return;
    scheduled = true;
    requestAnimationFrame(check);
  }).observe(document.documentElement, { childList: true, subtree: true });
  new ResizeObserver(() => {
    if (shelf.isConnected && columns() !== perRow) render();
  }).observe(shelf);
  check();
  void refreshShelf();
}
