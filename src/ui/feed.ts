/**
 * The Feed: title, Inbox · Sent · Friends tabs, and first run while signed out. Mounts into any
 * root element, so /feed/you?iris on YouTube and feed.html render the same thing.
 */
import { onEvent, request } from '../shared/messages';
import type { Counts, FriendsState, Profile, SeenKind, Share } from '../shared/types';
import { avatar, displayName, errorText, eyeIcon, h } from './dom';
import { handleCard, signInCard } from './first-run';
import { friendsPanel } from './friends';
import { moreMenu, signOutIcon } from './menu';
import { shareGrid } from './share-card';

type Tab = 'inbox' | 'sent' | 'friends';

const TABS: [Tab, string][] = [['inbox', 'Inbox'], ['sent', 'Sent'], ['friends', 'Friends']];
const SEEN_BY: Partial<Record<Tab, SeenKind>> = { inbox: 'shares', friends: 'requests' };

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
  let inbox: Share[] = [];
  let sent: Share[] = [];
  let counts: Counts = { shares: 0, requests: 0 };
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
      [friends, inbox, sent, counts] = await Promise.all([request('getFriends'), request('getInbox'), request('getSent'), request('getCounts')]);
      if (current !== generation) return;
      renderShell();
      markSeen();
    } catch (e) {
      if (current === generation) show(errorCard(errorText(e)));
    }
  }

  /** Re-fetches everything, then re-renders unless the User is mid-typing (it would wipe the field). */
  async function refresh(message = ''): Promise<void> {
    const current = generation;
    try {
      const next = await Promise.all([request('getFriends'), request('getInbox'), request('getSent'), request('getCounts')]);
      if (current !== generation) return;
      [friends, inbox, sent, counts] = next;
      notice = message;
    } catch (e) {
      notice = errorText(e);
    }
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement && el.contains(active) && active.value)) renderShell();
    markSeen();
  }

  /**
   * Viewing a tab clears what's New on it, including anything that arrives while it's on screen.
   * Only called while the count is above 0, so the `counts` event this sets off ends the cycle.
   */
  function markSeen(): void {
    const kind = SEEN_BY[tab];
    if (!profile || !kind || !counts[kind] || document.visibilityState !== 'visible') return;
    request('markSeen', { kind }).catch(() => {});
  }

  function unsend(share: Share): void {
    request('unsendShare', { id: share.id }).then(() => refresh('Unsent.'), (e) => refresh(errorText(e)));
  }

  function markWatched(share: Share): void {
    request('markWatched', { videoId: share.video_id }).then(() => refresh('Marked as watched.'), (e) => refresh(errorText(e)));
  }

  function showNotice(message: string): void {
    notice = message;
    renderShell();
  }

  function renderShell(): void {
    if (!profile || !friends) return;
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
            markSeen();
          },
        }, label);
        if (id === 'friends' && counts.requests) {
          button.append(h('span', { class: 'iris-dot', role: 'img', 'aria-label': 'New friend requests' }));
        }
        return button;
      }),
    );
    const account = moreMenu(
      'Iris account',
      [{
        label: 'Sign out of Iris',
        icon: signOutIcon,
        action: () => request('signOut').then(load, (e) => show(errorCard(errorText(e)))),
      }],
      h('div', { class: 'iris-menu-head' },
        h('div', { class: 'iris-menu-head-label' }, 'Signed in to Iris as'),
        h('div', { class: 'iris-menu-head-who' },
          avatar(profile, 40),
          h('div', {}, h('div', {}, displayName(profile)), h('div', {}, `@${profile.handle}`)),
        ),
      ),
      'iris-menu-account',
    );

    show(
      h('header', { class: 'iris-feed-head' },
        h('h1', { class: 'iris-title' }, eyeIcon(), 'Iris'),
        account,
      ),
      tabs,
      h('section', { class: 'iris-panel', role: 'tabpanel' }, panel()),
    );
  }

  function panel(): HTMLElement {
    if (tab === 'friends') return friendsPanel(friends!, refresh, notice);
    const shares = tab === 'inbox' ? inbox : sent;
    return h('div', {},
      notice ? h('p', { class: 'iris-notice', role: 'status' }, notice) : null,
      shares.length
        ? shareGrid(shares, tab, { onUnsend: unsend, onMarkWatched: markWatched, onNotice: showNotice })
        : h('p', { class: 'iris-empty' },
            tab === 'inbox' ? 'Videos your friends send you will show up here.' : 'Videos you send will show up here.'),
    );
  }

  const unsubscribe = onEvent((event) => {
    if (event.type === 'authChanged') void load();
    else if (event.type === 'counts' && profile) void refresh(notice);
  });
  document.addEventListener('visibilitychange', markSeen);
  void load();

  return () => {
    generation++;
    unsubscribe();
    document.removeEventListener('visibilitychange', markSeen);
    el.remove();
  };
}
