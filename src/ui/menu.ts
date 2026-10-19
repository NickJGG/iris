import { h, svg } from './dom';

export interface MenuItem {
  label: string;
  icon: () => SVGSVGElement;
  action: () => void;
}

/** A 24px single-path icon, as YouTube's menus use. */
export const menuIcon = (d: string) => () => svg('0 0 24 24', { d });

const moreIcon = () =>
  svg('0 0 24 24', {
    d: 'M12 16.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm0-6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm0-6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z',
  });

export const signOutIcon = menuIcon('M20 3v18H8v-1h11V4H8V3h12zm-8.9 12.1.7.7 4.7-4.8-4.8-4.8-.7.7 3.6 3.6H4v1h10.7l-3.6 3.6z');
export const deleteIcon = menuIcon('M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z');

/**
 * A ⋮ button that opens a small action menu under it, flipping left or up when it would leave the
 * window, as YouTube's does. An optional `header` sits above the items, ruled off from them.
 */
export function moreMenu(label: string, items: MenuItem[], header?: HTMLElement, menuClass = ''): HTMLElement {
  const button = h('button', { class: 'iris-icon-btn', type: 'button', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, moreIcon());
  const menu = h('div', { class: `iris-menu ${menuClass}`.trim(), role: 'menu', hidden: true });
  if (header) menu.append(header, h('hr', { class: 'iris-menu-rule' }));
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
    }, item.icon(), item.label));
  }

  button.addEventListener('click', () => {
    if (!menu.hidden) return close();
    menu.removeAttribute('data-flip-x');
    menu.removeAttribute('data-flip-y');
    menu.hidden = false;
    const box = menu.getBoundingClientRect();
    menu.toggleAttribute('data-flip-x', box.right > document.documentElement.clientWidth);
    menu.toggleAttribute('data-flip-y', box.bottom > window.innerHeight && box.top - box.height - button.offsetHeight >= 0);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    menu.querySelector<HTMLElement>('.iris-menu-item')?.focus();
  });
  return wrap;
}
