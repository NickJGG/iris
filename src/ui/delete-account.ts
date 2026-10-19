/**
 * The "Delete Iris account" confirm dialog, from the Feed's account menu. Reuses the composer's
 * modal; Delete stays disabled until the User types their handle.
 */
import { request } from '../shared/messages';
import type { Profile } from '../shared/types';
import { errorText, h } from './dom';
import { showToast } from './toast';

let closeCurrent: (() => void) | null = null;

export function openDeleteAccount(profile: Profile, onDeleted: () => void): void {
  closeCurrent?.();

  const handle = profile.handle ?? '';
  const matches = () => input.value.trim().replace(/^@/, '').toLowerCase() === handle.toLowerCase();

  const input = h('input', {
    class: 'iris-field-input',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-labelledby': 'iris-delete-label',
    oninput: () => {
      remove.disabled = !matches();
    },
  });
  const error = h('p', { class: 'iris-error', role: 'alert' });
  const cancel = h('button', { class: 'iris-btn', type: 'button', onclick: () => close() }, 'Cancel');
  const remove = h('button', { class: 'iris-btn iris-btn-primary', type: 'submit', disabled: true }, 'Delete account');

  const titleId = 'iris-delete-title';
  const panel = h('form', { class: 'iris-composer iris-confirm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: -1 },
    h('h2', { class: 'iris-composer-title', id: titleId }, 'Delete your Iris account?'),
    h('p', {}, 'This permanently deletes your Iris profile, your friends list, and every Share you’ve sent or received, including ones already in your friends’ Inboxes. You can’t undo this.'),
    h('p', { class: 'iris-confirm-label', id: 'iris-delete-label' }, 'Type ', h('strong', {}, `@${handle}`), ' to confirm'),
    h('label', { class: 'iris-field' }, input),
    error,
    h('div', { class: 'iris-composer-foot' }, cancel, remove),
  );
  const layer = h('div', { class: 'iris-root iris-composer-backdrop' }, panel);

  panel.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!matches()) return;
    remove.disabled = cancel.disabled = true;
    error.textContent = '';
    try {
      await request('deleteAccount');
      close();
      showToast('Your Iris account was deleted.');
      onDeleted();
    } catch (e) {
      error.textContent = errorText(e);
      remove.disabled = !matches();
      cancel.disabled = false;
    }
  });

  // Keys typed here must not reach YouTube's shortcuts (k, j, space, /, …).
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape' && !cancel.disabled) close();
  });
  layer.addEventListener('pointerdown', (event) => {
    if (event.target === layer && !cancel.disabled) close();
  });

  function close(): void {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    layer.remove();
  }
  closeCurrent = close;

  document.body.append(layer);
  input.focus();
}
