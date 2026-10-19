/**
 * The YouTube-style grid card for a Share, used by the Feed's Inbox and Sent grids and the home
 * shelf. The sender and note sit in a chip above the thumbnail. When the note is cut off, hover or
 * focus unfolds the chip in place as an overlay, so the card never changes size and the grid never
 * reflows.
 */
import { request } from '../shared/messages';
import type { Share, VideoStats } from '../shared/types';
import { formatTime, formatViews, timeAgo, timeAgoLong } from '../shared/video';
import { openComposer } from './composer';
import { avatar, displayName, eyeIcon, h, picture } from './dom';
import { menuIcon, moreMenu, type MenuItem } from './menu';

/** Absolute, because feed.html isn't on youtube.com. */
export function watchUrl(share: Pick<Share, 'video_id' | 'start_seconds'>): string {
  const start = share.start_seconds ? `&t=${share.start_seconds}s` : '';
  return `https://www.youtube.com/watch?v=${share.video_id}${start}`;
}

const stats = new Map<string, VideoStats | null>();
const loading = new Map<string, Promise<VideoStats | null>>();

function videoStats(videoId: string): Promise<VideoStats | null> {
  let promise = loading.get(videoId);
  if (!promise) {
    promise = request('getVideoStats', { videoId })
      .then((result) => {
        stats.set(videoId, result);
        return result;
      })
      .finally(() => loading.delete(videoId));
    loading.set(videoId, promise);
  }
  return promise;
}

const PREMIERE_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

function statsText(s: VideoStats | null): string {
  if (!s) return '';
  if (s.state === 'live') return 'Live now';
  if (s.state === 'upcoming') return s.startsAt ? `Premieres ${new Date(s.startsAt).toLocaleDateString('en', PREMIERE_DATE)}` : 'Upcoming';
  if (!s.published) return formatViews(s.views);
  return `${formatViews(s.views)} • ${s.state === 'streamed' ? 'Streamed ' : ''}${timeAgoLong(s.published)}`;
}

function badge(s: VideoStats | null): HTMLElement | null {
  if (!s) return null;
  if (s.state === 'live') return h('span', { class: 'iris-share-dur', 'data-live': true }, 'LIVE');
  if (s.state === 'upcoming') return h('span', { class: 'iris-share-dur' }, 'UPCOMING');
  return s.lengthSeconds ? h('span', { class: 'iris-share-dur' }, formatTime(s.lengthSeconds)) : null;
}

function fillStats(card: HTMLElement, s: VideoStats | null): void {
  card.querySelector('.iris-share-stats')!.textContent = statsText(s);
  card.querySelector('.iris-share-dur')?.remove();
  const b = badge(s);
  if (b) card.querySelector('.iris-share-thumb')!.append(b);
}

let nearViewport: IntersectionObserver | undefined;

/** Fetches stats only for cards about to scroll into view; one observer serves every card. */
function loadStatsWhenNear(card: HTMLElement, videoId: string): void {
  nearViewport ??= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      // Feed re-renders replace cards; drop the old ones rather than load for them.
      if (!target.isConnected) nearViewport!.unobserve(target);
      if (!isIntersecting) continue;
      nearViewport!.unobserve(target);
      const id = (target as HTMLElement).dataset.videoId!;
      videoStats(id).then((s) => fillStats(target as HTMLElement, s), () => {});
    }
  }, { rootMargin: '200px' });
  card.dataset.videoId = videoId;
  nearViewport.observe(card);
}

export type CardKind = 'inbox' | 'sent';

export interface CardActions {
  onUnsend?: (share: Share) => void;
  onMarkWatched?: (share: Share) => void;
  /** Where to confirm an action; absent on the shelf, which has nowhere to say it. */
  onNotice?: (message: string) => void;
}

const watchedIcon = menuIcon('M16.59 7.58 10 14.17l-3.59-3.58L5 12l5 5 8-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z');
const linkIcon = menuIcon('M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z');
const trashIcon = menuIcon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z');

function cardMenu(share: Share, kind: CardKind, unwatched: boolean, title: string, actions: CardActions): HTMLElement {
  const { onUnsend, onMarkWatched, onNotice } = actions;
  const items: (MenuItem | null)[] = [
    unwatched && onMarkWatched ? { label: 'Mark as watched', icon: watchedIcon, action: () => onMarkWatched(share) } : null,
    { label: 'Send to friends…', icon: eyeIcon, action: () => openComposer({ videoId: share.video_id }) },
    {
      label: 'Copy link',
      icon: linkIcon,
      action: () => navigator.clipboard.writeText(watchUrl(share)).then(
        () => onNotice?.('Link copied.'),
        () => onNotice?.('Couldn’t copy the link.'),
      ),
    },
    kind === 'sent' && onUnsend ? { label: 'Unsend', icon: trashIcon, action: () => onUnsend(share) } : null,
  ];
  return moreMenu(`More actions for ${title}`, items.filter((item) => item !== null));
}

export function shareCard(share: Share, kind: CardKind, actions: CardActions = {}): HTMLElement {
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
        h('div', { class: 'iris-share-meta iris-share-stats' }),
      ),
      cardMenu(share, kind, unwatched, title, actions),
    ),
  );
  if (stats.has(share.video_id)) fillStats(card, stats.get(share.video_id)!);
  else loadStatsWhenNear(card, share.video_id);
  return card;
}

export function shareGrid(shares: Share[], kind: CardKind, actions: CardActions = {}): HTMLElement {
  return h('div', { class: 'iris-grid' }, ...shares.map((s) => shareCard(s, kind, actions)));
}
