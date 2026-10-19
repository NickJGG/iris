/**
 * The send composer: a popover under the ◉ Send pill, or a centered modal when opened from the
 * right-click menu (no player there, so no Start at). Ticking several Friends sends one Share each;
 * Friends who already have the video from you show "Sent ✓" and can't be ticked.
 */
import { request } from '../shared/messages';
import type { Profile } from '../shared/types';
import { formatTime, parseTime } from '../shared/video';
import { avatar, displayName, errorText, h } from './dom';

const NOTE_MAX = 140;
const WIDTH = 320;

export interface ComposerOptions {
  videoId: string;
  /** The pill to hang the popover from; without one the composer is a modal. */
  anchor?: HTMLElement;
  /** Player position to pre-fill Start at; Start at is hidden when absent. */
  currentTime?: number;
}

let closeCurrent: (() => void) | null = null;

export const isComposerOpen = () => closeCurrent !== null;

export function closeComposer(): void {
  closeCurrent?.();
}

export function openComposer({ videoId, anchor, currentTime }: ComposerOptions): void {
  closeComposer();

  let friends: Profile[] = [];
  const sentTo = new Set<string>();
  const selected = new Set<string>();
  let sending = false;
  let justSent = false;

  const search = h('input', {
    class: 'iris-field-input',
    placeholder: 'Search friends',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Search friends',
    oninput: () => renderList(),
  });
  const list = h('div', { class: 'iris-composer-list', role: 'group', 'aria-label': 'Friends' },
    h('p', { class: 'iris-empty' }, 'Loading friends…'));
  const counter = h('span', { class: 'iris-composer-counter', 'aria-hidden': 'true' }, `0/${NOTE_MAX}`);
  const note = h('textarea', {
    class: 'iris-composer-note',
    rows: 2,
    maxlength: NOTE_MAX,
    placeholder: 'Add a note (optional)',
    'aria-label': 'Note',
    oninput: () => updateCounter(),
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

  const panel = h('div', { class: 'iris-root iris-composer', role: 'dialog', 'aria-label': 'Send with Iris' },
    h('h2', { class: 'iris-composer-title' }, 'Send with Iris'),
    h('label', { class: 'iris-field iris-composer-search' }, search),
    list,
    h('div', { class: 'iris-composer-note-wrap' }, note, counter),
    h('div', { class: 'iris-composer-foot' }, start, send),
    status,
  );
  const layer = anchor ? panel : h('div', { class: 'iris-root iris-composer-backdrop' }, panel);

  function updateCounter(): void {
    counter.textContent = `${note.value.length}/${NOTE_MAX}`;
  }

  function updateSend(): void {
    send.disabled = sending || selected.size === 0;
    send.textContent =
      sending ? 'Sending…'
      : justSent && !selected.size ? 'Sent ✓'
      : selected.size ? `Send to ${selected.size}`
      : 'Send';
  }

  function setStatus(text: string, bad = false): void {
    status.textContent = text;
    if (bad) status.dataset.kind = 'bad';
    else delete status.dataset.kind;
  }

  function friendRow(f: Profile): HTMLElement {
    const already = sentTo.has(f.id);
    const control = already
      ? h('span', { class: 'iris-composer-sent' }, 'Sent ✓')
      : h('input', {
          type: 'checkbox',
          checked: selected.has(f.id),
          onchange: (event) => {
            if ((event.currentTarget as HTMLInputElement).checked) selected.add(f.id);
            else selected.delete(f.id);
            justSent = false;
            updateSend();
          },
        });
    return h('label', { class: 'iris-composer-friend', 'aria-disabled': already ? 'true' : null },
      avatar(f, 32),
      h('span', { class: 'iris-person' },
        h('span', { class: 'iris-person-name' }, displayName(f)),
        f.handle && f.display_name ? h('span', { class: 'iris-person-handle' }, ` @${f.handle}`) : null,
      ),
      control,
    );
  }

  function renderList(): void {
    if (!friends.length) {
      list.replaceChildren(h('p', { class: 'iris-empty' }, 'No friends yet. ',
        h('a', { class: 'iris-link', href: '/feed/iris' }, 'Add friends')));
      return;
    }
    const query = search.value.trim().replace(/^@/, '').toLowerCase();
    const matches = friends.filter((f) => !query || [f.display_name, f.handle].some((s) => s?.toLowerCase().includes(query)));
    list.replaceChildren(...(matches.length ? matches.map(friendRow) : [h('p', { class: 'iris-empty' }, 'No friends match.')]));
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
      const result = await request('sendShares', { videoId, recipients, note: note.value.trim() || null, startSeconds });
      for (const id of [...result.sent, ...result.alreadySent]) sentTo.add(id);
      selected.clear();
      note.value = '';
      updateCounter();
      justSent = true;
      const names = friends.filter((f) => recipients.includes(f.id)).map(displayName);
      setStatus(`Sent to ${names.join(', ')}.`);
    } catch (e) {
      setStatus(errorText(e), true);
      // Some inserts may have landed before the failure.
      await loadSentTo().catch(() => {});
      for (const id of sentTo) selected.delete(id);
    } finally {
      sending = false;
      renderList();
      updateSend();
    }
  }

  // Keys typed here must not reach YouTube's shortcuts (k, j, space, /, …).
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') close();
  });
  const onOutside = (event: Event) => {
    const target = event.target as Node;
    if (!panel.contains(target) && !anchor?.contains(target)) close();
  };

  function close(): void {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    const hadFocus = panel.contains(document.activeElement);
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', close);
    layer.remove();
    anchor?.setAttribute('aria-expanded', 'false');
    if (hadFocus) anchor?.focus();
  }
  closeCurrent = close;

  if (anchor) {
    // Absolute in the document, so it scrolls with the pill instead of floating over the page.
    const rect = anchor.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - WIDTH - 8;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - WIDTH / 2, maxLeft));
    panel.classList.add('iris-composer-popover');
    panel.style.top = `${rect.bottom + window.scrollY + 8}px`;
    panel.style.left = `${left + window.scrollX}px`;
    anchor.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', close);
  } else {
    panel.setAttribute('aria-modal', 'true');
  }
  document.addEventListener('pointerdown', onOutside, true);
  document.body.append(layer);
  search.focus();

  Promise.all([request('getFriends'), loadSentTo()]).then(
    ([state]) => {
      friends = state.friends;
      renderList();
    },
    (e) => list.replaceChildren(h('p', { class: 'iris-error' }, errorText(e))),
  );
}
