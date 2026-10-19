/**
 * Sending from YouTube: the ◉ Send pill in the watch page's action row, and the composer the
 * right-click menu opens. YouTube re-renders the row freely, so a document observer puts the pill
 * back whenever it goes missing. Signed out, both route to the Feed's first run instead.
 */
import { request } from '../shared/messages';
import { closeComposer, isComposerOpen, openComposer } from '../ui/composer';
import { eyeIcon, h } from '../ui/dom';
import { FEED_PATH, watchVideoId } from './route';

const ACTION_ROW = 'ytd-watch-flexy:not([hidden]) ytd-watch-metadata #top-level-buttons-computed';
const LIKE_BUTTONS = 'segmented-like-dislike-button-view-model, ytd-segmented-like-dislike-button-renderer';

const pill = h('button', {
  class: 'iris-root iris-btn iris-send-pill',
  type: 'button',
  title: 'Send to friends with Iris',
  'aria-haspopup': 'dialog',
  'aria-expanded': 'false',
}, eyeIcon(), 'Send');

pill.addEventListener('click', () => {
  if (isComposerOpen()) return closeComposer();
  const videoId = watchVideoId();
  if (videoId) void openSend(videoId, pill);
});

/** Opens the composer for a video: under `anchor` with Start at, or as a modal without. */
export async function openSend(videoId: string, anchor?: HTMLElement): Promise<void> {
  // On error (e.g. Iris unconfigured) open anyway: the composer shows it.
  const auth = await request('getAuthState').catch(() => null);
  if (auth && (!auth.signedIn || !auth.profile.handle)) return location.assign(FEED_PATH);
  const currentTime = anchor ? document.querySelector<HTMLVideoElement>('#movie_player video')?.currentTime ?? 0 : undefined;
  openComposer({ videoId, anchor, currentTime });
}

// YouTube has no stable hook on Share itself (its label is localized); it follows like/dislike.
function insert(): void {
  const row = document.querySelector(ACTION_ROW);
  if (!row) return;
  const like = row.querySelector(LIKE_BUTTONS);
  const likeSlot = like && [...row.children].find((child) => child.contains(like));
  if (likeSlot) likeSlot.after(pill);
  else row.prepend(pill);
}

export function startSendPill(): void {
  let scheduled = false;
  const check = () => {
    scheduled = false;
    if (watchVideoId() && !pill.isConnected) insert();
  };
  new MutationObserver(() => {
    if (scheduled || pill.isConnected || !watchVideoId()) return;
    scheduled = true;
    requestAnimationFrame(check);
  }).observe(document.documentElement, { childList: true, subtree: true });
  check();
}
