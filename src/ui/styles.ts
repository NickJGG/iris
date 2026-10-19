import css from './iris.css';

export function injectStyles(): void {
  if (document.getElementById('iris-styles')) return;
  const style = document.createElement('style');
  style.id = 'iris-styles';
  style.textContent = css;
  (document.head ?? document.documentElement).append(style);
}
