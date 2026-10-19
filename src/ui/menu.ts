import { h, svg } from './dom';

export interface MenuItem {
  label: string;
  action: () => void;
}

const moreIcon = () =>
  svg('0 0 24 24', {
    d: 'M12 16.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm0-6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm0-6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z',
  });

/** A ⋮ button that opens a small action menu below it. */
export function moreMenu(label: string, items: MenuItem[]): HTMLElement {
  const button = h('button', { class: 'iris-icon-btn', type: 'button', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, moreIcon());
  const menu = h('div', { class: 'iris-menu', role: 'menu', hidden: true });
  const wrap = h('div', { class: 'iris-menu-wrap' }, button, menu);

  const close = () => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onOutside = (event: Event) => {
    if (!wrap.contains(event.target as Node)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      button.focus();
    }
  };

  for (const item of items) {
    menu.append(h('button', {
      class: 'iris-menu-item',
      type: 'button',
      role: 'menuitem',
      onclick: () => {
        close();
        item.action();
      },
    }, item.label));
  }

  button.addEventListener('click', () => {
    if (!menu.hidden) return close();
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    (menu.firstElementChild as HTMLElement | null)?.focus();
  });
  return wrap;
}
