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
export const logoIcon = () => svg('0 0 24 24', { d: 'M12 2A9.5 9.5 0 1 1 12 21A9.5 9.5 0 1 1 12 2ZM12 4A7.5 7.5 0 1 0 12 19A7.5 7.5 0 1 0 12 4ZM4.43 15.65L7.85 19.07A0.6 0.6 0 0 1 7.56 20.08L3.16 21.05A0.6 0.6 0 0 1 2.45 20.34L3.42 15.94A0.6 0.6 0 0 1 4.43 15.65ZM10.74 8.4L15.32 10.98A0.6 0.6 0 0 1 15.32 12.02L10.74 14.6A0.6 0.6 0 0 1 9.85 14.07L9.85 8.93A0.6 0.6 0 0 1 10.74 8.4Z' });

export const displayName = (p: Profile) => p.display_name || (p.handle ? `@${p.handle}` : 'Someone');

export const avatar = (profile: Profile, size = 40) => picture(profile.avatar_url, displayName(profile), size);

/** A round picture, falling back to the name's first letter when there's none or it fails to load. */
export function picture(src: string | null, name: string, size = 40): HTMLElement {
  const letter = () =>
    h('span', { class: 'iris-avatar iris-avatar-letter', style: `--iris-avatar: ${size}px`, 'aria-hidden': 'true' },
      name.replace(/^@/, '').charAt(0).toUpperCase());
  if (!src) return letter();
  const img = h('img', {
    class: 'iris-avatar',
    style: `--iris-avatar: ${size}px`,
    src,
    alt: '',
    referrerpolicy: 'no-referrer',
  });
  img.addEventListener('error', () => img.replaceWith(letter()), { once: true });
  return img;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
