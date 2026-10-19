/**
 * The YouTube-style grid card for a Share, used by the Feed's Inbox and Sent grids and the home
 * shelf. The sender and note sit in a chip above the thumbnail. When the note is cut off, hover or
 * focus unfolds the chip in place as an overlay, so the card never changes size and the grid never
 * reflows.
 */
import type { Share } from '../shared/types';
import { avatar, displayName, h, picture } from './dom';
import { moreMenu } from './menu';

/** Absolute, because feed.html isn't on youtube.com. */
export function watchUrl(share: Pick<Share, 'video_id' | 'start_seconds'>): string {
  const start = share.start_seconds ? `&t=${share.start_seconds}s` : '';
  return `https://www.youtube.com/watch?v=${share.video_id}${start}`;
}

/** Each unit's size in the one before it, starting from minutes. */
const STEPS: [number, string][] = [[60, 'h'], [24, 'd'], [7, 'w'], [52 / 12, 'mo'], [12, 'y']];

/** "just now", "5m ago", "2h ago", "3d ago", "2w ago", "4mo ago", "1y ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  let value = (now - Date.parse(iso)) / 60_000;
  if (value < 1) return 'just now';
  let unit = 'm';
  for (const [size, next] of STEPS) {
    if (value < size) break;
    value /= size;
    unit = next;
  }
  return `${Math.floor(value)}${unit} ago`;
}

export type CardKind = 'inbox' | 'sent';

export function shareCard(share: Share, kind: CardKind, onUnsend?: (share: Share) => void): HTMLElement {
  const href = watchUrl(share);
  const title = share.title ?? 'YouTube video';
  const unwatched = kind === 'inbox' && !share.watched_at;
  const chipParts = () => [
    h('span', {}, kind === 'sent' ? 'To ' : null, h('span', { class: 'iris-share-who' }, displayName(share.user))),
    h('span', { class: 'iris-share-when' }, `· ${timeAgo(share.created_at)}`),
    share.note ? h('span', { class: 'iris-share-chip-note' }, `· ${share.note}`) : null,
  ];
  const chip = h('div', { class: 'iris-share-chip' }, avatar(share.user, 20), ...chipParts());
  const note = chip.querySelector<HTMLElement>('.iris-share-chip-note');
  // Measured on each hover/focus rather than observed, so grid resizes need no bookkeeping.
  const measure = () => card.toggleAttribute('data-cut', !!note && note.scrollWidth > note.clientWidth);

  const card = h('div', {
    class: 'iris-share',
    'data-watched': kind === 'inbox' && !unwatched ? 'true' : null,
    onpointerenter: measure,
    onfocusin: measure,
  },
    h('div', { class: 'iris-share-from' },
      chip,
      note
        ? h('div', { class: 'iris-share-chip iris-share-chip-full', 'aria-hidden': 'true' },
            avatar(share.user, 20), h('div', { class: 'iris-share-chip-text' }, ...chipParts()))
        : null,
    ),
    h('a', { class: 'iris-share-thumb', href, tabindex: -1, 'aria-hidden': 'true' },
      h('img', { src: `https://i.ytimg.com/vi/${share.video_id}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
      unwatched ? h('span', { class: 'iris-share-new' }, 'New') : null,
    ),
    h('div', { class: 'iris-share-body' },
      picture(share.channel_avatar, share.channel ?? title, 36),
      h('div', { class: 'iris-share-text' },
        h('a', { class: 'iris-share-title', href, title }, title),
        share.channel ? h('div', { class: 'iris-share-meta' }, share.channel) : null,
      ),
      kind === 'sent' && onUnsend
        ? moreMenu(`More actions for ${title}`, [{ label: 'Unsend', action: () => onUnsend(share) }])
        : null,
    ),
  );
  return card;
}

export function shareGrid(shares: Share[], kind: CardKind, onUnsend?: (share: Share) => void): HTMLElement {
  return h('div', { class: 'iris-grid' }, ...shares.map((s) => shareCard(s, kind, onUnsend)));
}
