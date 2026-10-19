/**
 * The Feed: title, Inbox · Sent · Friends tabs, and first run while signed out. Mounts into any
 * root element, so /feed/iris on YouTube and feed.html render the same thing.
 */
import { onEvent, request } from '../shared/messages';
import type { FriendsState, Profile } from '../shared/types';
import { errorText, eyeIcon, h } from './dom';
import { handleCard, signInCard } from './first-run';
import { friendsPanel } from './friends';

type Tab = 'inbox' | 'sent' | 'friends';

const TABS: [Tab, string][] = [['inbox', 'Inbox'], ['sent', 'Sent'], ['friends', 'Friends']];

export function mountFeed(root: HTMLElement): () => void {
  const el = h('div', { class: 'iris-feed' });
  root.append(el);
  // YouTube's global shortcuts (k, j, /, …) would otherwise fire while typing.
  el.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) event.stopPropagation();
  });

  let tab: Tab = 'inbox';
  let profile: Profile | null = null;
  let friends: FriendsState | null = null;
  let notice = '';
  let generation = 0;

  const show = (...nodes: HTMLElement[]) => el.replaceChildren(...nodes);

  const errorCard = (message: string) => {
    const retry = h('button', { class: 'iris-btn', type: 'button', onclick: () => void load() }, 'Try again');
    return h('div', { class: 'iris-card' }, h('div', { class: 'iris-card-eye' }, eyeIcon()), h('h2', {}, 'Iris can’t connect'), h('p', {}, message), retry);
  };

  async function load(): Promise<void> {
    const current = ++generation;
    try {
      const auth = await request('getAuthState');
      if (current !== generation) return;
      if (!auth.signedIn) {
        profile = friends = null;
        return show(signInCard(load));
      }
      if (!auth.profile.handle) {
        return show(handleCard(auth.profile, () => {
          tab = 'friends';
          void load();
        }));
      }
      profile = auth.profile;
      friends = await request('getFriends');
      if (current === generation) renderShell();
    } catch (e) {
      if (current === generation) show(errorCard(errorText(e)));
    }
  }

  async function refreshFriends(message = ''): Promise<void> {
    const current = generation;
    try {
      const next = await request('getFriends');
      if (current !== generation) return;
      friends = next;
      notice = message;
    } catch (e) {
      notice = errorText(e);
    }
    renderShell();
  }

  function renderShell(): void {
    if (!profile || !friends) return;
    const incoming = friends.incoming.length;
    const tabs = h('div', { class: 'iris-tabs', role: 'tablist' },
      ...TABS.map(([id, label]) => {
        const button = h('button', {
          class: 'iris-tab',
          type: 'button',
          role: 'tab',
          'aria-selected': String(id === tab),
          onclick: () => {
            tab = id;
            notice = '';
            renderShell();
          },
        }, label);
        if (id === 'friends' && incoming) {
          button.append(h('span', { class: 'iris-count', 'aria-label': `${incoming} friend requests` }, String(incoming)));
        }
        return button;
      }),
    );
    const signOut = h('button', {
      class: 'iris-link',
      type: 'button',
      onclick: () => request('signOut').then(load, (e) => show(errorCard(errorText(e)))),
    }, 'Sign out');

    show(
      h('header', { class: 'iris-feed-head' },
        h('h1', { class: 'iris-title' }, eyeIcon(), 'Iris'),
        h('div', { class: 'iris-whoami' }, `@${profile.handle}`, ' · ', signOut),
      ),
      tabs,
      h('section', { class: 'iris-panel', role: 'tabpanel' }, panel()),
    );
  }

  function panel(): HTMLElement {
    if (tab === 'friends') return friendsPanel(friends!, refreshFriends, notice);
    return h('p', { class: 'iris-empty' },
      tab === 'inbox' ? 'Videos your friends send you will show up here.' : 'Videos you send will show up here.');
  }

  const unsubscribe = onEvent((event) => {
    if (event.type === 'authChanged') void load();
  });
  void load();

  return () => {
    generation++;
    unsubscribe();
    el.remove();
  };
}
