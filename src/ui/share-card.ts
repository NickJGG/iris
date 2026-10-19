/**
 * The YouTube-style grid card for a Share, used by the Feed's Inbox and Sent grids and the home
 * shelf. The note is clamped to one line; on hover or focus the full note floats over it as an
 * overlay, so the card never changes size and the grid never reflows.
 */
import type { Share } from '../shared/types';
import { avatar, displayName, h } from './dom';
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
  const who = h('span', { class: 'iris-share-who' }, displayName(share.user));
  const when = timeAgo(share.created_at);

  return h('div', { class: 'iris-share', 'data-watched': kind === 'inbox' && !unwatched ? 'true' : null },
    h('a', { class: 'iris-share-thumb', href, tabindex: -1, 'aria-hidden': 'true' },
      h('img', { src: `https://i.ytimg.com/vi/${share.video_id}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
      unwatched ? h('span', { class: 'iris-share-new' }, 'NEW') : null,
    ),
    h('div', { class: 'iris-share-body' },
      avatar(share.user, 36),
      h('div', { class: 'iris-share-text' },
        h('a', { class: 'iris-share-title', href, title }, title),
        share.channel ? h('div', { class: 'iris-share-meta' }, share.channel) : null,
        h('div', { class: 'iris-share-meta' },
          ...(kind === 'inbox' ? [who, ` shared · ${when}`] : ['To ', who, ` · ${when}`])),
        share.note
          ? h('div', { class: 'iris-share-note' },
              h('div', { class: 'iris-share-note-line' }, `“${share.note}”`),
              h('div', { class: 'iris-share-note-full', 'aria-hidden': 'true' }, `“${share.note}”`))
          : null,
      ),
      kind === 'sent' && onUnsend
        ? moreMenu(`More actions for ${title}`, [{ label: 'Unsend', action: () => onUnsend(share) }])
        : null,
    ),
  );
}

export function shareGrid(shares: Share[], kind: CardKind, onUnsend?: (share: Share) => void): HTMLElement {
  return h('div', { class: 'iris-grid' }, ...shares.map((s) => shareCard(s, kind, onUnsend)));
}
