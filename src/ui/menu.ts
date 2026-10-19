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

/** A ⋮ button that opens a small action menu under it, flipping left or up when it would leave the window, as YouTube's does. */
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
    (menu.firstElementChild as HTMLElement | null)?.focus();
  });
  return wrap;
}
