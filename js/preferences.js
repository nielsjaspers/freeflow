import { DEFAULT_FONT_SIZE } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { persistPreferences } from './storage.js';

export function applyTheme(isDark, options = {}) {
  disableTransitionsTemporarily();
  const { persist = true } = options;
  const preferDark =
    typeof isDark === 'boolean' ? isDark : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('theme-dark', preferDark);
  document.documentElement.classList.toggle('theme-dark', preferDark);
  if (dom.darkModeToggle) {
    dom.darkModeToggle.setAttribute('aria-pressed', String(preferDark));
    const label = preferDark ? 'Switch to light mode' : 'Switch to dark mode';
    dom.darkModeToggle.setAttribute('aria-label', label);
    dom.darkModeToggle.setAttribute('title', label);
  }
  if (persist) {
    persistPreferences({ darkMode: preferDark });
  } else {
    state.preferences.darkMode = preferDark;
  }
}

export function applyFontSize(size, options = {}) {
  const { persist = true } = options;
  const clamped = Math.min(28, Math.max(14, Number(size) || DEFAULT_FONT_SIZE));
  if (dom.noteContent) {
    dom.noteContent.style.fontSize = `${clamped}px`;
  }
  if (dom.fontSizeInput) {
    dom.fontSizeInput.value = clamped;
  }
  if (dom.fontSizeValue) {
    dom.fontSizeValue.textContent = `${clamped}px`;
  }
  if (persist) {
    persistPreferences({ fontSize: clamped });
  } else {
    state.preferences.fontSize = clamped;
  }
}

export function resetFontSize() {
  applyFontSize(DEFAULT_FONT_SIZE);
}

function disableTransitionsTemporarily() {
  const root = document.documentElement;
  if (!root.classList.contains('no-transitions')) {
    root.classList.add('no-transitions');
    window.requestAnimationFrame(() => {
      root.classList.remove('no-transitions');
    });
  }
}
