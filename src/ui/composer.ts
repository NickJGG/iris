/**
 * The send composer: a centered modal shaped like YouTube's Share, from the ◉ Send pill (with
 * Start at), the right-click menu or a share card's menu. Friends sit in a row of round avatars,
 * most recent recipients first; picking several sends one Share each. Friends who already have the
 * video from you show "Sent ✓" and can't be picked.
 */
import { request } from '../shared/messages';
import type { Profile } from '../shared/types';
import { formatTime, parseTime } from '../shared/video';
import { avatar, displayName, errorText, h, svg } from './dom';
import { showToast } from './toast';

const NOTE_MAX = 140;
const COUNTER_FROM = 120;

const closeIcon = () =>
  svg('0 0 24 24', { d: 'M12.71 12l8.15 8.15-.71.71L12 12.71l-8.15 8.15-.71-.71L11.29 12 3.15 3.85l.71-.71L12 11.29l8.15-8.15.71.71L12.71 12z' });
const nextIcon = () => svg('0 0 24 24', { d: 'M9.4 18.4l-.7-.7 5.6-5.6-5.6-5.7.7-.7 6.4 6.4-6.4 6.3z' });
const prevIcon = () => svg('0 0 24 24', { d: 'M14.6 18.4L8.3 12l6.3-6.4.7.7-5.6 5.7 5.6 5.6-.7.8z' });
const tickIcon = () => svg('0 0 24 24', { d: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z' });

export interface ComposerOptions {
  videoId: string;
  /** Gets `aria-expanded` while open and focus back on close. */
  opener?: HTMLElement;
  /** Player position to pre-fill Start at; Start at is hidden when absent. */
  currentTime?: number;
}

let closeCurrent: (() => void) | null = null;

export const isComposerOpen = () => closeCurrent !== null;

export function closeComposer(): void {
  closeCurrent?.();
}

export function openComposer({ videoId, opener, currentTime }: ComposerOptions): void {
  closeComposer();

  let friends: Profile[] = [];
  const sentTo = new Set<string>();
  const selected = new Set<string>();
  let sending = false;

  const targets = h('div', { class: 'iris-send-targets', role: 'group', 'aria-label': 'Friends', onscroll: () => updateArrows() });
  const prev = h('button', {
    class: 'iris-send-scroll iris-send-scroll-prev',
    type: 'button',
    tabindex: -1,
    'aria-label': 'Previous',
    hidden: true,
    onclick: () => targets.scrollBy({ left: -targets.clientWidth * 0.8 }),
  }, prevIcon());
  const next = h('button', {
    class: 'iris-send-scroll iris-send-scroll-next',
    type: 'button',
    tabindex: -1,
    'aria-label': 'Next',
    hidden: true,
    onclick: () => targets.scrollBy({ left: targets.clientWidth * 0.8 }),
  }, nextIcon());
  targets.addEventListener('focusin', (event) => rove(event.target as HTMLButtonElement, false));
  const row = h('div', { class: 'iris-send-row' }, h('p', { class: 'iris-empty' }, 'Loading friends…'));

  const counter = h('span', { class: 'iris-composer-counter', 'aria-hidden': 'true', hidden: true });
  const note = h('textarea', {
    class: 'iris-composer-note',
    rows: 1,
    maxlength: NOTE_MAX,
    placeholder: 'Add a note (optional)',
    'aria-label': 'Note',
    oninput: () => {
      note.style.height = 'auto';
      note.style.height = `${note.scrollHeight}px`;
      counter.textContent = `${note.value.length}/${NOTE_MAX}`;
      counter.hidden = note.value.length < COUNTER_FROM;
    },
  });

  const startToggle = h('input', { type: 'checkbox' });
  const startTime = h('input', {
    class: 'iris-composer-time',
    value: formatTime(currentTime ?? 0),
    size: 7,
    spellcheck: 'false',
    'aria-label': 'Start time',
    oninput: () => {
      startToggle.checked = true;
    },
  });
  const start = currentTime === undefined
    ? null
    : h('label', { class: 'iris-composer-start' }, startToggle, 'Start at', startTime);

  const send = h('button', { class: 'iris-btn iris-btn-primary', type: 'button', disabled: true, onclick: () => void submit() }, 'Send');
  const status = h('p', { class: 'iris-notice', role: 'status' });

  const titleId = 'iris-composer-title';
  const panel = h('div', { class: 'iris-composer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: -1 },
    h('h2', { class: 'iris-composer-title', id: titleId }, 'Send to friends'),
    h('button', { class: 'iris-icon-btn iris-composer-close', type: 'button', 'aria-label': 'Close', onclick: () => close() }, closeIcon()),
    row,
    h('div', { class: 'iris-composer-notebox' }, note, counter),
    h('hr', { class: 'iris-composer-rule' }),
    h('div', { class: 'iris-composer-foot' }, start, send),
    status,
  );
  const layer = h('div', { class: 'iris-root iris-composer-backdrop' }, panel);

  function updateSend(): void {
    send.disabled = sending || selected.size === 0;
    send.textContent = sending ? 'Sending…' : selected.size ? `Send to ${selected.size}` : 'Send';
  }

  function setStatus(text: string, bad = false): void {
    status.textContent = text;
    if (bad) status.dataset.kind = 'bad';
    else delete status.dataset.kind;
  }

  function updateArrows(): void {
    prev.hidden = targets.scrollLeft <= 1;
    next.hidden = targets.scrollLeft + targets.clientWidth >= targets.scrollWidth - 1;
  }

  const targetButtons = () => [...targets.querySelectorAll<HTMLButtonElement>('.iris-send-target')];

  function target(f: Profile): HTMLElement {
    const already = sentTo.has(f.id);
    const picked = selected.has(f.id);
    const button = h('button', {
      class: 'iris-send-target',
      type: 'button',
      tabindex: -1,
      'data-id': f.id,
      'aria-label': displayName(f),
      'aria-pressed': already ? null : String(picked),
      'aria-disabled': already ? 'true' : null,
      onclick: () => {
        if (already) return;
        if (selected.has(f.id)) selected.delete(f.id);
        else selected.add(f.id);
        const on = selected.has(f.id);
        button.setAttribute('aria-pressed', String(on));
        tick.hidden = !on;
        updateSend();
      },
    });
    const tick = h('span', { class: 'iris-send-tick', hidden: !picked }, tickIcon());
    button.append(
      h('span', { class: 'iris-send-avatar' }, avatar(f, 60), tick),
      h('span', { class: 'iris-send-name', 'aria-hidden': 'true' }, already ? 'Sent ✓' : displayName(f).split(/\s+/)[0]),
    );
    if (already) button.title = `${displayName(f)} already has this video`;
    return button;
  }

  /** One tab stop for the whole row; ←/→ move between avatars. */
  function rove(to: HTMLButtonElement, focus = true): void {
    for (const b of targetButtons()) b.tabIndex = b === to ? 0 : -1;
    if (focus) to.focus();
  }

  function renderRow(): void {
    if (!friends.length) {
      row.replaceChildren(h('p', { class: 'iris-empty' }, 'No friends yet. ',
        h('a', { class: 'iris-link', href: '/feed/you?iris' }, 'Add friends')));
      return;
    }
    const focusedId = targets.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.id : undefined;
    targets.replaceChildren(...friends.map(target));
    if (!row.contains(targets)) row.replaceChildren(prev, targets, next);
    const buttons = targetButtons();
    const focused = buttons.find((b) => b.dataset.id === focusedId);
    rove(focused ?? buttons.find((b) => !b.hasAttribute('aria-disabled')) ?? buttons[0], !!focused);
    updateArrows();
  }

  async function loadSentTo(): Promise<void> {
    for (const id of await request('getSentTo', { videoId })) sentTo.add(id);
  }

  async function submit(): Promise<void> {
    let startSeconds: number | null = null;
    if (start && startToggle.checked) {
      startSeconds = parseTime(startTime.value);
      if (startSeconds === null) return setStatus('Start at needs a time like 4:10.', true);
    }
    const recipients = [...selected];
    sending = true;
    updateSend();
    setStatus('');
    try {
      await request('sendShares', { videoId, recipients, note: note.value.trim() || null, startSeconds });
      const names = friends.filter((f) => recipients.includes(f.id)).map(displayName);
      close();
      showToast(`Sent to ${names.join(', ')}`);
    } catch (e) {
      setStatus(errorText(e), true);
      // Some inserts may have landed before the failure.
      await loadSentTo().catch(() => {});
      for (const id of sentTo) selected.delete(id);
      sending = false;
      renderRow();
      updateSend();
    }
  }

  // Keys typed here must not reach YouTube's shortcuts (k, j, space, /, …).
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') return close();
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = targetButtons();
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    event.preventDefault();
    const to = buttons[i + (event.key === 'ArrowRight' ? 1 : -1)];
    if (to) rove(to);
  });
  layer.addEventListener('pointerdown', (event) => {
    if (event.target === layer) close();
  });

  function close(): void {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    const hadFocus = layer.contains(document.activeElement);
    layer.remove();
    opener?.setAttribute('aria-expanded', 'false');
    if (hadFocus) opener?.focus();
  }
  closeCurrent = close;

  opener?.setAttribute('aria-expanded', 'true');
  document.body.append(layer);
  panel.focus();

  Promise.all([request('getFriends'), loadSentTo(), request('getSent').catch(() => [])]).then(
    ([state, , sent]) => {
      const rank = new Map<string, number>();
      sent.forEach((share, i) => rank.has(share.user.id) || rank.set(share.user.id, i));
      const order = (f: Profile) => rank.get(f.id) ?? Number.MAX_SAFE_INTEGER;
      friends = [...state.friends].sort((a, b) => order(a) - order(b));
      const focusRow = !layer.contains(document.activeElement) || document.activeElement === panel;
      renderRow();
      if (focusRow) targets.querySelector<HTMLButtonElement>('.iris-send-target[tabindex="0"]')?.focus();
    },
    (e) => row.replaceChildren(h('p', { class: 'iris-error' }, errorText(e))),
  );
}
