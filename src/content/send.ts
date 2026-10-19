/**
 * Sending from YouTube: the ◉ Send pill in the watch page's action row, and the composer the
 * right-click menu opens. YouTube re-renders the row freely, so a document observer puts the pill
 * back whenever it goes missing. Signed out, both route to the Feed's first run instead.
 */
import { request } from '../shared/messages';
import { closeComposer, isComposerOpen, openComposer } from '../ui/composer';
import { eyeIcon, h } from '../ui/dom';
import { FEED_HREF, watchVideoId } from './route';

const ACTION_ROW = 'ytd-watch-flexy:not([hidden]) ytd-watch-metadata #top-level-buttons-computed';
const LIKE_BUTTONS = 'segmented-like-dislike-button-view-model, ytd-segmented-like-dislike-button-renderer';

const TOOLTIP = 'Send to friends';

// YouTube's own button classes, so its stylesheet draws the pill exactly like Share. Its hover
// response is script-driven, so ours is in iris.css.
const pill = h('button', {
  class: 'iris-send-pill ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono '
    + 'ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextIconLeading ytSpecButtonShapeNextEnableBackdropFilterExperiment '
    + 'ytSpecButtonShapeNextMainstageIconSize ytSpecButtonShapeNextMainstagePadding',
  type: 'button',
  'aria-label': TOOLTIP,
  'aria-haspopup': 'dialog',
  'aria-expanded': 'false',
},
  h('div', { class: 'ytSpecButtonShapeNextIcon ytSpecButtonShapeNextElevatedContent', 'aria-hidden': 'true' }, eyeIcon()),
  h('div', { class: 'ytSpecButtonShapeNextButtonTextContent ytSpecButtonShapeNextElevatedContent' }, 'Send'),
  h('div', { class: 'ytSpecTouchFeedbackShapeHost ytSpecTouchFeedbackShapeTouchResponse', 'aria-hidden': 'true' },
    h('div', { class: 'ytSpecTouchFeedbackShapeStroke' }),
    h('div', { class: 'ytSpecTouchFeedbackShapeFill' })),
  h('div', {
    class: 'contribYtLightShapeHost contribYtLightShapeStaticRimLightTonal contribYtLightShapeStaticRimLight',
    'aria-hidden': 'true',
  }, h('div', { class: 'contribYtLightShapeStaticWashLight contribYtLightShapeStaticWashLightTonal' })),
);

// In the top layer like YouTube's, so the action row's overflow can't clip it.
const tooltip = h('div', { class: 'iris-root iris-tooltip', popover: 'manual', 'aria-hidden': 'true' }, TOOLTIP);

function showTooltip(): void {
  if (isComposerOpen()) return;
  if (!tooltip.isConnected) document.body.append(tooltip);
  tooltip.showPopover();
  const anchor = pill.getBoundingClientRect();
  const left = anchor.left + (anchor.width - tooltip.offsetWidth) / 2;
  tooltip.style.left = `${Math.max(8, Math.min(left, innerWidth - tooltip.offsetWidth - 8))}px`;
  tooltip.style.top = `${anchor.bottom + 18}px`;
}

function hideTooltip(): void {
  if (tooltip.matches(':popover-open')) tooltip.hidePopover();
}

pill.addEventListener('pointerenter', showTooltip);
pill.addEventListener('pointerleave', hideTooltip);
pill.addEventListener('focus', () => pill.matches(':focus-visible') && showTooltip());
pill.addEventListener('blur', hideTooltip);
addEventListener('scroll', hideTooltip, { passive: true });

pill.addEventListener('click', () => {
  hideTooltip();
  if (isComposerOpen()) return closeComposer();
  const videoId = watchVideoId();
  if (videoId) void openSend(videoId, pill);
});

/** Opens the composer for a video: under `anchor` with Start at, or as a modal without. */
export async function openSend(videoId: string, anchor?: HTMLElement): Promise<void> {
  // On error (e.g. Iris unconfigured) open anyway: the composer shows it.
  const auth = await request('getAuthState').catch(() => null);
  if (auth && (!auth.signedIn || !auth.profile.handle)) return location.assign(FEED_HREF);
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
