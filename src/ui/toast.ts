/** A bottom-left notification like YouTube's; a new one replaces the last. */
import { h } from './dom';

const DURATION = 4000;

const toast = h('div', { class: 'iris-root iris-toast', role: 'status' });
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string): void {
  if (!toast.isConnected) document.body.append(toast);
  toast.textContent = text;
  // Restart the fade-in even when it's already showing.
  toast.classList.remove('iris-toast-open');
  void toast.offsetWidth;
  toast.classList.add('iris-toast-open');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('iris-toast-open'), DURATION);
}
