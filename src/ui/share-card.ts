/**
 * The YouTube-style grid card for a Share, used by the Feed's Inbox and Sent grids and the home
 * shelf. The sender and note sit in a chip above the thumbnail. When the note is cut off, hover or
 * focus unfolds the chip in place as an overlay, so the card never changes size and the grid never
 * reflows.
 */
import { request } from '../shared/messages';
import type { Share, VideoStats } from '../shared/types';
import { formatTime, formatViews, timeAgo, timeAgoLong } from '../shared/video';
import { avatar, displayName, h, picture } from './dom';
import { moreMenu } from './menu';

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
        h('div', { class: 'iris-share-meta iris-share-stats' }),
      ),
      kind === 'sent' && onUnsend
        ? moreMenu(`More actions for ${title}`, [{ label: 'Unsend', action: () => onUnsend(share) }])
        : null,
    ),
  );
  if (stats.has(share.video_id)) fillStats(card, stats.get(share.video_id)!);
  else loadStatsWhenNear(card, share.video_id);
  return card;
}

export function shareGrid(shares: Share[], kind: CardKind, onUnsend?: (share: Share) => void): HTMLElement {
  return h('div', { class: 'iris-grid' }, ...shares.map((s) => shareCard(s, kind, onUnsend)));
}
