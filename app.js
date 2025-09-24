const STORAGE_KEY = 'freeflow.notes';
const PREFERENCES_KEY = 'freeflow.preferences';
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_TIMER_MINUTES = 15;
const MIN_TIMER_MINUTES = 1;
const MAX_TIMER_MINUTES = 180;
const TIMER_TICK_MS = 250;

const noteListEl = document.getElementById('note-list');
const noteTitleEl = document.getElementById('note-title');
const noteContentEl = document.getElementById('note-content');
const timestampEl = document.getElementById('note-timestamp');
const timerDisplayEl = document.getElementById('timer-display');
const searchInputEl = document.getElementById('search-input');
const newNoteBtn = document.getElementById('new-note-btn');
const fontSizeInput = document.getElementById('font-size-input');
const timerMinutesInput = document.getElementById('timer-minutes-input');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const timerToggle = document.getElementById('timer-toggle');

const state = {
  notes: [],
  activeNoteId: null,
  searchQuery: '',
  preferences: {
    darkMode: null,
    fontSize: DEFAULT_FONT_SIZE,
    activeNoteId: null,
    timerMinutes: DEFAULT_TIMER_MINUTES,
  },
};

const timerState = {
  durationMs: DEFAULT_TIMER_MINUTES * 60000,
  remainingMs: DEFAULT_TIMER_MINUTES * 60000,
  targetTimestamp: null,
  intervalId: null,
  isRunning: false,
};

// ---------- Storage helpers ----------
function loadNotes() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(Boolean)
        .map((note) => ({
          id: note.id || generateId(),
          title: note.title || '',
          content: note.content || '',
          updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
        }));
    }
  } catch (error) {
    console.error('Failed to load notes', error);
  }
  return [];
}

function persistNotes() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

function loadPreferences() {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.preferences = {
        darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : null,
        fontSize:
          typeof parsed.fontSize === 'number' && parsed.fontSize >= 14 && parsed.fontSize <= 28
            ? parsed.fontSize
            : DEFAULT_FONT_SIZE,
        activeNoteId: typeof parsed.activeNoteId === 'string' ? parsed.activeNoteId : null,
        timerMinutes:
          typeof parsed.timerMinutes === 'number'
            ? clamp(Math.round(parsed.timerMinutes), MIN_TIMER_MINUTES, MAX_TIMER_MINUTES)
            : DEFAULT_TIMER_MINUTES,
      };
    }
  } catch (error) {
    console.error('Failed to load preferences', error);
  }
}

function persistPreferences(partial) {
  state.preferences = {
    ...state.preferences,
    ...partial,
  };
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.preferences));
}

// ---------- Initialization ----------
function init() {
  loadPreferences();
  applyTheme(state.preferences.darkMode, { persist: false });
  applyFontSize(state.preferences.fontSize || DEFAULT_FONT_SIZE, { persist: false });
  setTimerMinutes(state.preferences.timerMinutes || DEFAULT_TIMER_MINUTES, { persist: false });

  state.notes = loadNotes();

  if (!state.notes.length) {
    const freshNote = buildNewNote();
    state.notes.push(freshNote);
  }

  const preferredId = state.preferences.activeNoteId;
  const hasPreferred = preferredId && state.notes.some((note) => note.id === preferredId);
  state.activeNoteId = hasPreferred ? preferredId : state.notes[0].id;

  renderNoteList();
  renderActiveNote();

  newNoteBtn.addEventListener('click', handleCreateNote);
  noteListEl.addEventListener('click', handleNoteListClick);
  noteListEl.addEventListener('keydown', handleNoteListKeydown);
  noteTitleEl.addEventListener('input', handleTitleInput);
  noteContentEl.addEventListener('input', handleContentInput);
  searchInputEl.addEventListener('input', handleSearchInput);
  fontSizeInput.addEventListener('input', handleFontSizeInput);
  darkModeToggle.addEventListener('click', handleDarkModeToggle);
  timerMinutesInput.addEventListener('input', handleTimerMinutesInput);
  timerMinutesInput.addEventListener('change', handleTimerMinutesChange);
  timerToggle.addEventListener('click', handleTimerToggle);

  window.addEventListener('storage', handleStorageSync);
}

// ---------- Event handlers ----------
function handleCreateNote() {
  const newNote = buildNewNote();
  state.notes.unshift(newNote);
  changeActiveNote(newNote.id);
  persistNotes();
  renderNoteList();
  renderActiveNote();
}

function handleNoteListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.noteAction;
  const noteId = target.dataset.noteId || target.closest('.note-card')?.dataset.noteId;
  if (!noteId) return;

  if (action === 'delete') {
    event.stopPropagation();
    deleteNote(noteId);
    return;
  }

  changeActiveNote(noteId);
  renderNoteList();
  renderActiveNote();
}

function handleNoteListKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest('.note-card');
  if (!card) return;
  event.preventDefault();
  const noteId = card.dataset.noteId;
  if (noteId) {
    changeActiveNote(noteId);
    renderNoteList();
    renderActiveNote();
  }
}

let titleUpdateTimer;
function handleTitleInput(event) {
  const value = event.target.value;
  updateActiveNote({ title: value });
  clearTimeout(titleUpdateTimer);
  titleUpdateTimer = window.setTimeout(() => {
    persistNotes();
    renderNoteList();
  }, 200);
}

let contentUpdateTimer;
function handleContentInput(event) {
  const value = event.target.value;
  updateActiveNote({ content: value });
  clearTimeout(contentUpdateTimer);
  contentUpdateTimer = window.setTimeout(() => {
    persistNotes();
    renderNoteList();
  }, 200);
}

function handleSearchInput(event) {
  state.searchQuery = event.target.value;
  renderNoteList();
}

function handleFontSizeInput(event) {
  applyFontSize(event.target.value);
}

function handleDarkModeToggle() {
  const next = !document.body.classList.contains('theme-dark');
  applyTheme(next);
}

function handleTimerMinutesInput(event) {
  if (timerState.isRunning) return;
  setTimerMinutes(event.target.value, { persist: false });
}

function handleTimerMinutesChange(event) {
  if (timerState.isRunning) {
    timerMinutesInput.value = Math.round(timerState.durationMs / 60000);
    return;
  }
  setTimerMinutes(event.target.value, { persist: true });
}

function handleTimerToggle() {
  if (timerState.isRunning) {
    stopTimer();
    return;
  }

  startTimer();
}

function handleStorageSync(event) {
  if (event.key === STORAGE_KEY) {
    state.notes = loadNotes();
    renderNoteList();
    renderActiveNote();
  }
  if (event.key === PREFERENCES_KEY) {
    loadPreferences();
    applyTheme(state.preferences.darkMode, { persist: false });
    applyFontSize(state.preferences.fontSize || DEFAULT_FONT_SIZE, { persist: false });
    if (!timerState.isRunning) {
      setTimerMinutes(state.preferences.timerMinutes || DEFAULT_TIMER_MINUTES, { persist: false });
    }
  }
}

// ---------- State mutations ----------
function buildNewNote() {
  return {
    id: generateId(),
    title: '',
    content: '',
    updatedAt: Date.now(),
  };
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function changeActiveNote(id) {
  if (state.activeNoteId === id) return;
  state.activeNoteId = id;
  persistPreferences({ activeNoteId: id });
}

function updateActiveNote(patch) {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  if (!note) return;
  let didChange = false;
  if (typeof patch.title === 'string' && patch.title !== note.title) {
    note.title = patch.title;
    didChange = true;
  }
  if (typeof patch.content === 'string' && patch.content !== note.content) {
    note.content = patch.content;
    didChange = true;
  }
  if (didChange) {
    note.updatedAt = Date.now();
    timestampEl.textContent = formatFullTimestamp(note.updatedAt);
  }
}

function deleteNote(id) {
  const idx = state.notes.findIndex((note) => note.id === id);
  if (idx === -1) return;
  state.notes.splice(idx, 1);

  if (!state.notes.length) {
    const replacement = buildNewNote();
    state.notes.push(replacement);
    changeActiveNote(replacement.id);
  } else if (state.activeNoteId === id) {
    const nextIndex = Math.max(0, idx - 1);
    changeActiveNote(state.notes[nextIndex].id);
  }

  persistNotes();
  renderNoteList();
  renderActiveNote();
}

// ---------- Rendering ----------
function renderNoteList() {
  const query = state.searchQuery.trim().toLowerCase();
  noteListEl.innerHTML = '';

  const notes = query ? applySearch(query, state.notes) : sortNotes(state.notes);

  if (!notes.length) {
    const empty = document.createElement('div');
    empty.className = 'note-list__empty';
    empty.textContent = query ? 'No notes match your search.' : 'No notes yet. Create one to get started.';
    noteListEl.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.noteId = note.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    if (note.id === state.activeNoteId) {
      card.classList.add('is-active');
    }

    const contentBox = document.createElement('div');
    contentBox.className = 'note-card__content';

    const titleEl = document.createElement('h2');
    titleEl.className = 'note-card__title';
    titleEl.textContent = note.title.trim() || 'Untitled note';

    const previewEl = document.createElement('p');
    previewEl.className = 'note-card__preview';
    previewEl.textContent = buildPreview(note.content);

    const footer = document.createElement('div');
    footer.className = 'note-card__footer';

    const meta = document.createElement('span');
    meta.className = 'note-card__meta';
    meta.textContent = formatRelativeTimestamp(note.updatedAt);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'note-card__delete';
    deleteBtn.dataset.noteAction = 'delete';
    deleteBtn.dataset.noteId = note.id;
    deleteBtn.textContent = 'Delete';

    footer.append(meta, deleteBtn);
    contentBox.append(titleEl, previewEl);
    card.append(contentBox, footer);
    noteListEl.appendChild(card);
  });
}

function renderActiveNote() {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  if (!note) {
    noteTitleEl.value = '';
    noteContentEl.value = '';
    timestampEl.textContent = '';
    return;
  }

  noteTitleEl.value = note.title;
  noteContentEl.value = note.content;
  timestampEl.textContent = formatFullTimestamp(note.updatedAt);
}

function applyTheme(isDark, options = {}) {
  const { persist = true } = options;
  const preferDark =
    typeof isDark === 'boolean' ? isDark : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('theme-dark', preferDark);
  darkModeToggle.setAttribute('aria-pressed', String(preferDark));
  darkModeToggle.textContent = preferDark ? 'Light mode' : 'Dark mode';
  if (persist) {
    persistPreferences({ darkMode: preferDark });
  } else {
    state.preferences.darkMode = preferDark;
  }
}

function applyFontSize(size, options = {}) {
  const { persist = true } = options;
  const clamped = Math.min(28, Math.max(14, Number(size) || DEFAULT_FONT_SIZE));
  noteContentEl.style.fontSize = `${clamped}px`;
  fontSizeInput.value = clamped;
  if (persist) {
    persistPreferences({ fontSize: clamped });
  } else {
    state.preferences.fontSize = clamped;
  }
}

function setTimerMinutes(minutes, options = {}) {
  const { persist = true } = options;
  const numeric = Number(minutes);
  const valid = Number.isFinite(numeric) ? Math.round(numeric) : DEFAULT_TIMER_MINUTES;
  const clamped = clamp(valid, MIN_TIMER_MINUTES, MAX_TIMER_MINUTES);

  timerState.durationMs = clamped * 60000;
  if (!timerState.isRunning) {
    timerState.remainingMs = timerState.durationMs;
    updateTimerDisplay(timerState.remainingMs);
    timerDisplayEl.classList.remove('is-complete');
    timerToggle.textContent = 'Start timer';
    timerToggle.setAttribute('aria-pressed', 'false');
  }

  timerMinutesInput.value = clamped;

  if (persist) {
    persistPreferences({ timerMinutes: clamped });
  } else {
    state.preferences.timerMinutes = clamped;
  }
}

function startTimer() {
  if (timerState.isRunning) return;
  const minutes = Number(timerMinutesInput.value) || state.preferences.timerMinutes || DEFAULT_TIMER_MINUTES;
  setTimerMinutes(minutes, { persist: true });
  timerState.remainingMs = timerState.durationMs;
  timerState.targetTimestamp = Date.now() + timerState.remainingMs;
  timerState.intervalId = window.setInterval(tickTimer, TIMER_TICK_MS);
  timerState.isRunning = true;
  timerToggle.textContent = 'Stop timer';
  timerToggle.setAttribute('aria-pressed', 'true');
  timerMinutesInput.disabled = true;
  timerDisplayEl.classList.add('is-active');
  timerDisplayEl.classList.remove('is-complete');
}

function stopTimer(options = {}) {
  const { completed = false } = options;
  if (timerState.intervalId) {
    window.clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.isRunning = false;
  timerToggle.setAttribute('aria-pressed', 'false');
  timerMinutesInput.disabled = false;
  timerDisplayEl.classList.remove('is-active');

  if (completed) {
    timerState.remainingMs = 0;
    updateTimerDisplay(timerState.remainingMs);
    timerDisplayEl.classList.add('is-complete');
    timerToggle.textContent = 'Start timer';
  } else {
    timerDisplayEl.classList.remove('is-complete');
    resetTimer();
  }
}

function resetTimer() {
  timerState.remainingMs = timerState.durationMs;
  updateTimerDisplay(timerState.remainingMs);
  timerDisplayEl.classList.remove('is-complete');
  timerToggle.textContent = 'Start timer';
  timerToggle.setAttribute('aria-pressed', 'false');
}

function tickTimer() {
  const remaining = Math.max(0, timerState.targetTimestamp - Date.now());
  timerState.remainingMs = remaining;
  updateTimerDisplay(remaining);
  if (remaining <= 0) {
    completeTimer();
  }
}

function completeTimer() {
  stopTimer({ completed: true });
  announceTimerComplete();
}

function announceTimerComplete() {
  if (typeof timerDisplayEl.focus === 'function') {
    timerDisplayEl.focus();
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(200);
  }
}

function updateTimerDisplay(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  timerDisplayEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ---------- Search helpers ----------
function applySearch(query, notes) {
  const scored = [];
  for (const note of notes) {
    const haystack = `${note.title}\n${note.content}`.toLowerCase();
    const score = fuzzyScore(query, haystack);
    if (score > 0) {
      scored.push({ note, score });
    }
  }
  scored.sort((a, b) => {
    if (b.score === a.score) {
      return b.note.updatedAt - a.note.updatedAt;
    }
    return b.score - a.score;
  });
  return scored.map((item) => item.note);
}

function fuzzyScore(query, text) {
  let score = 0;
  let textIdx = 0;

  for (let i = 0; i < query.length; i += 1) {
    const queryChar = query[i];
    let found = false;
    while (textIdx < text.length) {
      if (text[textIdx] === queryChar) {
        score += 10;
        if (i > 0 && textIdx > 0 && text[textIdx - 1] === query[i - 1]) {
          score += 5;
        }
        textIdx += 1;
        found = true;
        break;
      }
      textIdx += 1;
    }
    if (!found) {
      return 0;
    }
  }

  return score;
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

function buildPreview(content) {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function formatRelativeTimestamp(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFullTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `Updated ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---------- Kick things off ----------
window.addEventListener('DOMContentLoaded', init);

// Expose utilities for manual tweaking if needed
window.freeflow = {
  applyTheme,
  applyFontSize,
  setTimerMinutes,
};
