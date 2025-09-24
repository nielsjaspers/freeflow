// Core state keys used in localStorage
const STORAGE_KEY = 'freeflow.notes';
const PREFERENCES_KEY = 'freeflow.preferences';

// Cached DOM references
const noteListEl = document.getElementById('note-list');
const noteTitleEl = document.getElementById('note-title');
const noteContentEl = document.getElementById('note-content');
const timestampEl = document.getElementById('note-timestamp');
const timerDisplayEl = document.getElementById('timer-display');
const searchInputEl = document.getElementById('search-input');
const newNoteBtn = document.getElementById('new-note-btn');
const fontSizeInput = document.getElementById('font-size-input');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const timerToggle = document.getElementById('timer-toggle');

// Application bootstrap will be fleshed out in subsequent commits.
function init() {
  document.body.classList.toggle('theme-dark', prefersDarkMode());
  fontSizeInput.value = 18;
  noteContentEl.style.fontSize = `${fontSizeInput.value}px`;
}

function prefersDarkMode() {
  const stored = window.localStorage.getItem(PREFERENCES_KEY);
  if (!stored) return window.matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    const prefs = JSON.parse(stored);
    return Boolean(prefs.darkMode);
  } catch (error) {
    console.error('Failed to parse stored preferences', error);
    return false;
  }
}

window.addEventListener('DOMContentLoaded', init);
