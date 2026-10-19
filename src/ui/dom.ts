/**
 * Minimal DOM building. Never uses innerHTML: YouTube enforces Trusted Types, and names come
 * from other Users.
 */
import type { Profile } from '../shared/types';

type AttrValue = string | number | boolean | null | undefined | ((event: Event) => void);
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(name.slice(2), value);
    else if (value === true) el.setAttribute(name, '');
    else if (value !== false && value != null) el.setAttribute(name, String(value));
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

export function svg(viewBox: string, ...paths: { d: string; fillRule?: string }[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const root = document.createElementNS(ns, 'svg');
  root.setAttribute('viewBox', viewBox);
  root.setAttribute('fill', 'currentColor');
  root.setAttribute('aria-hidden', 'true');
  for (const { d, fillRule } of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    if (fillRule) path.setAttribute('fill-rule', fillRule);
    root.append(path);
  }
  return root;
}

/** Same shape as icons/iris.svg. */
export const eyeIcon = () =>
  svg(
    '0 0 24 24',
    {
      d: 'M1.2 12A11.859 11.859 0 0 1 22.8 12A11.859 11.859 0 0 1 1.2 12ZM3.49 12A9.819 9.819 0 0 1 20.51 12A9.819 9.819 0 0 1 3.49 12Z',
      fillRule: 'evenodd',
    },
    { d: 'M7.92 12a4.08 4.08 0 1 0 8.16 0a4.08 4.08 0 1 0 -8.16 0Z' },
  );

export const displayName = (p: Profile) => p.display_name || (p.handle ? `@${p.handle}` : 'Someone');

export function avatar(profile: Profile, size = 40): HTMLElement {
  const letter = () =>
    h('span', { class: 'iris-avatar iris-avatar-letter', style: `--iris-avatar: ${size}px`, 'aria-hidden': 'true' },
      displayName(profile).replace(/^@/, '').charAt(0).toUpperCase());
  if (!profile.avatar_url) return letter();
  const img = h('img', {
    class: 'iris-avatar',
    style: `--iris-avatar: ${size}px`,
    src: profile.avatar_url,
    alt: '',
    referrerpolicy: 'no-referrer',
  });
  img.addEventListener('error', () => img.replaceWith(letter()), { once: true });
  return img;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
