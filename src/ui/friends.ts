import { request } from '../shared/messages';
import type { FriendRequest, FriendsState, Profile } from '../shared/types';
import { avatar, displayName, errorText, h } from './dom';
import { moreMenu } from './menu';

/** Re-fetches the Friends state and re-renders, optionally showing `notice` under the add field. */
export type Refresh = (notice?: string) => Promise<void>;

const FRIENDLY_ERRORS: Record<string, string> = {
  'no user with that handle': 'No one has that handle.',
  'already friends': 'You’re already friends.',
  'cannot friend yourself': 'That’s your own handle.',
};

function person(profile: Profile, subtitle?: string): HTMLElement {
  return h('div', { class: 'iris-person' },
    h('span', { class: 'iris-person-name' }, displayName(profile)),
    profile.handle && profile.display_name ? h('span', { class: 'iris-person-handle' }, ` @${profile.handle}`) : null,
    subtitle ? h('div', { class: 'iris-person-sub' }, subtitle) : null,
  );
}

function row(profile: Profile, subtitle: string | undefined, ...actions: HTMLElement[]): HTMLElement {
  return h('div', { class: 'iris-row' }, avatar(profile), person(profile, subtitle), ...actions);
}

export function friendsPanel(state: FriendsState, refresh: Refresh, notice = ''): HTMLElement {
  const status = h('p', { class: 'iris-notice', role: 'status' }, notice);

  /** Runs an RPC from a button, disabling it meanwhile; errors land in the status line. */
  const act = (button: HTMLButtonElement, run: () => Promise<unknown>, done?: string) => {
    button.disabled = true;
    run().then(
      () => refresh(done),
      (e) => {
        button.disabled = false;
        status.textContent = FRIENDLY_ERRORS[errorText(e)] ?? errorText(e);
        status.dataset.kind = 'bad';
      },
    );
  };

  const button = (label: string, primary: boolean, onclick: (b: HTMLButtonElement) => void) => {
    const b = h('button', { class: primary ? 'iris-btn iris-btn-primary' : 'iris-btn', type: 'button' }, label);
    b.addEventListener('click', () => onclick(b));
    return b;
  };

  const input = h('input', {
    class: 'iris-field-input',
    placeholder: 'Add a friend by exact handle',
    maxlength: 21,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Friend’s handle',
  });
  const send = h('button', { class: 'iris-btn iris-btn-primary', type: 'submit' }, 'Send request');
  const add = h('form', { class: 'iris-add' }, h('label', { class: 'iris-field' }, h('span', { 'aria-hidden': 'true' }, '@'), input), send);
  add.addEventListener('submit', (event) => {
    event.preventDefault();
    const handle = input.value.trim().replace(/^@/, '').toLowerCase();
    if (!handle) return input.focus();
    act(send, () => request('sendFriendRequest', { handle }), `Request sent to @${handle}.`);
  });

  const incomingRow = (r: FriendRequest) =>
    row(r.user, 'wants to be friends',
      button('Accept', true, (b) => act(b, () => request('acceptRequest', { id: r.id }), `You and ${displayName(r.user)} are friends.`)),
      button('Decline', false, (b) => act(b, () => request('declineRequest', { id: r.id }))),
    );
  const outgoingRow = (r: FriendRequest) =>
    row(r.user, 'Request sent · pending',
      button('Cancel', false, (b) => act(b, () => request('cancelRequest', { id: r.id }))),
    );
  const friendRow = (f: Profile) =>
    row(f, undefined,
      moreMenu(`More actions for ${displayName(f)}`, [
        {
          label: 'Remove friend',
          action: () =>
            request('removeFriend', { id: f.id }).then(
              () => refresh(`Removed ${displayName(f)}.`),
              (e) => refresh(errorText(e)),
            ),
        },
      ]),
    );

  const requests = [...state.incoming.map(incomingRow), ...state.outgoing.map(outgoingRow)];
  return h('div', { class: 'iris-friends' },
    add,
    status,
    requests.length ? h('h3', { class: 'iris-section-title' }, 'Requests') : null,
    ...requests,
    h('h3', { class: 'iris-section-title' }, `Friends · ${state.friends.length}`),
    ...(state.friends.length
      ? state.friends.map(friendRow)
      : [h('p', { class: 'iris-empty' }, 'No friends yet. Ask for their handle and add them above.')]),
  );
}
