import { request } from '../shared/messages';
import { HANDLE_PATTERN, type Profile } from '../shared/types';
import { errorText, logoIcon, h } from './dom';

const googleIcon = () => h('span', { class: 'iris-google-g', 'aria-hidden': 'true' }, 'G');

export function signInCard(onSignedIn: () => void): HTMLElement {
  const error = h('p', { class: 'iris-error', role: 'alert' });
  const button = h('button', { class: 'iris-btn iris-btn-outline', type: 'button' }, googleIcon(), 'Sign in with Google');
  button.addEventListener('click', async () => {
    button.disabled = true;
    error.textContent = '';
    try {
      await request('signIn');
      onSignedIn();
    } catch (e) {
      error.textContent = errorText(e);
      button.disabled = false;
    }
  });
  return h('div', { class: 'iris-card' },
    h('div', { class: 'iris-card-logo' }, logoIcon()),
    h('h2', {}, 'Iris'),
    h('p', {}, 'See the videos your friends send you, right here on YouTube.'),
    button,
    error,
    h('p', { class: 'iris-fine' }, 'Iris only sees your name and profile picture.'),
  );
}

/** Google's name → a handle suggestion: the first name if it's long enough, else the whole name. */
export function suggestHandle(name: string | null): string {
  if (!name) return '';
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const first = slug(name.trim().split(/\s+/)[0] ?? '');
  return (first.length >= 3 ? first : slug(name.trim().replace(/\s+/g, '_'))).slice(0, 20);
}

export function handleCard(profile: Profile, onClaimed: () => void): HTMLElement {
  const input = h('input', {
    class: 'iris-handle-input',
    value: suggestHandle(profile.display_name),
    maxlength: 20,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Handle',
    'aria-describedby': 'iris-handle-status',
  });
  const status = h('span', { class: 'iris-handle-status', id: 'iris-handle-status', 'aria-live': 'polite' });
  const error = h('p', { class: 'iris-error', role: 'alert' });
  const submit = h('button', { class: 'iris-btn iris-btn-primary', type: 'submit', disabled: true }, 'Continue');

  let checked = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (text: string, kind: '' | 'ok' | 'bad') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  const check = async () => {
    const value = input.value;
    submit.disabled = true;
    if (!HANDLE_PATTERN.test(value)) {
      setStatus(value ? '3–20 characters: a–z, 0–9 and _' : '', 'bad');
      return;
    }
    setStatus('Checking…', '');
    try {
      const result = await request('checkHandle', { handle: value });
      if (input.value !== value) return;
      if (result.available) {
        checked = value;
        submit.disabled = false;
        setStatus('✓ available', 'ok');
      } else {
        setStatus(result.reason === 'taken' ? 'Taken' : '3–20 characters: a–z, 0–9 and _', 'bad');
      }
    } catch (e) {
      if (input.value === value) setStatus(errorText(e), 'bad');
    }
  };

  input.addEventListener('input', () => {
    const cleaned = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleaned !== input.value) input.value = cleaned;
    clearTimeout(timer);
    timer = setTimeout(check, 300);
  });

  const form = h('form', { class: 'iris-card' },
    h('div', { class: 'iris-card-logo' }, logoIcon()),
    h('h2', {}, 'Pick your handle'),
    h('p', {}, 'Friends add you by your exact handle. Nobody can browse or search for you otherwise.'),
    h('label', { class: 'iris-handle-field' }, h('span', { 'aria-hidden': 'true' }, '@'), input, status),
    submit,
    error,
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || input.value !== checked) return;
    submit.disabled = true;
    error.textContent = '';
    try {
      await request('claimHandle', { handle: checked });
      onClaimed();
    } catch (e) {
      error.textContent = errorText(e);
      void check();
    }
  });

  void check();
  queueMicrotask(() => input.focus());
  return form;
}
