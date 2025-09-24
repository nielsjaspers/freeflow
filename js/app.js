import {
  STORAGE_KEY,
  PREFERENCES_KEY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TIMER_MINUTES,
} from './constants.js';
import { state, timerState, mobileMediaQuery } from './state.js';
import { dom } from './dom.js';
import {
  loadPreferences,
  loadNotes,
  persistNotes,
} from './storage.js';
import { applyTheme, applyFontSize, resetFontSize } from './preferences.js';
import {
  setTimerMinutes,
  onTimerToggle,
  onTimerMinutesInput,
  onTimerMinutesChange,
  onTimerStop,
} from './timer.js';
import {
  setSidebarCollapsed,
  updateOverlayVisibility,
  handleViewportChange,
} from './sidebar.js';
import {
  createNote,
  changeActiveNote,
  updateActiveNote,
  deleteNote,
  renderNoteList,
  renderActiveNote,
  updateSearchQuery,
  syncNotesFromStorage,
  buildNewNote,
} from './notes.js';

let titleUpdateTimer = null;
let contentUpdateTimer = null;

function init() {
  loadPreferences();
  applyTheme(state.preferences.darkMode, { persist: false });
  applyFontSize(state.preferences.fontSize || DEFAULT_FONT_SIZE, { persist: false });
  setTimerMinutes(state.preferences.timerMinutes || DEFAULT_TIMER_MINUTES, { persist: false });

  const storedCollapse = state.preferences.sidebarCollapsed;
  const initialCollapsed =
    typeof storedCollapse === 'boolean' ? storedCollapse : mobileMediaQuery.matches;
  const rememberCollapse = typeof storedCollapse === 'boolean';
  setSidebarCollapsed(initialCollapsed, { persist: false, remember: rememberCollapse });

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

  bindEvents();
  updateOverlayVisibility();
}

function bindEvents() {
  dom.newNoteBtn?.addEventListener('click', handleCreateNote);
  dom.noteList?.addEventListener('click', handleNoteListClick);
  dom.noteList?.addEventListener('keydown', handleNoteListKeydown);
  dom.noteTitle?.addEventListener('input', handleTitleInput);
  dom.noteContent?.addEventListener('input', handleContentInput);
  dom.searchInput?.addEventListener('input', handleSearchInput);
  dom.fontSizeInput?.addEventListener('input', (event) => applyFontSize(event.target.value));
  dom.fontResetBtn?.addEventListener('click', resetFontSize);
  dom.darkModeToggle?.addEventListener('click', handleDarkModeToggle);
  dom.timerMinutesInput?.addEventListener('input', onTimerMinutesInput);
  dom.timerMinutesInput?.addEventListener('change', onTimerMinutesChange);
  dom.timerToggle?.addEventListener('click', onTimerToggle);
  dom.timerStop?.addEventListener('click', onTimerStop);
  dom.drawerToggle?.addEventListener('click', handleDrawerToggle);
  dom.appOverlay?.addEventListener('click', () =>
    setSidebarCollapsed(true, { persist: !mobileMediaQuery.matches, remember: !mobileMediaQuery.matches })
  );

  if (typeof mobileMediaQuery.addEventListener === 'function') {
    mobileMediaQuery.addEventListener('change', handleViewportChange);
  } else {
    mobileMediaQuery.addListener(handleViewportChange);
  }

  window.addEventListener('storage', handleStorageSync);
}

function handleCreateNote() {
  createNote();
  collapseSidebarForMobile();
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
  collapseSidebarForMobile();
}

function handleNoteListKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest('.note-card');
  if (!card) return;
  event.preventDefault();
  const noteId = card.dataset.noteId;
  if (!noteId) return;

  changeActiveNote(noteId);
  renderNoteList();
  renderActiveNote();
  collapseSidebarForMobile();
}

function handleTitleInput(event) {
  const value = event.target.value;
  updateActiveNote({ title: value });
  window.clearTimeout(titleUpdateTimer);
  titleUpdateTimer = window.setTimeout(() => {
    persistNotes();
    renderNoteList();
  }, 200);
}

function handleContentInput(event) {
  const value = event.target.value;
  updateActiveNote({ content: value });
  window.clearTimeout(contentUpdateTimer);
  contentUpdateTimer = window.setTimeout(() => {
    persistNotes();
    renderNoteList();
  }, 200);
}

function handleSearchInput(event) {
  updateSearchQuery(event.target.value);
}

function handleDarkModeToggle() {
  const next = !document.body.classList.contains('theme-dark');
  applyTheme(next);
}

function handleDrawerToggle() {
  const rememberPreference = !mobileMediaQuery.matches;
  setSidebarCollapsed(!state.ui.sidebarCollapsed, {
    persist: rememberPreference,
    remember: rememberPreference,
  });
}

function collapseSidebarForMobile() {
  if (mobileMediaQuery.matches) {
    setSidebarCollapsed(true, { persist: false, remember: false });
  }
}

function handleStorageSync(event) {
  if (event.key === STORAGE_KEY) {
    syncNotesFromStorage();
  }
  if (event.key === PREFERENCES_KEY) {
    loadPreferences();
    applyTheme(state.preferences.darkMode, { persist: false });
    applyFontSize(state.preferences.fontSize || DEFAULT_FONT_SIZE, { persist: false });
    if (!timerState.isRunning) {
      setTimerMinutes(state.preferences.timerMinutes || DEFAULT_TIMER_MINUTES, { persist: false });
    }
    const collapsePref = state.preferences.sidebarCollapsed;
    const collapseValue =
      typeof collapsePref === 'boolean' ? collapsePref : mobileMediaQuery.matches;
    const remember = typeof collapsePref === 'boolean';
    setSidebarCollapsed(collapseValue, { persist: false, remember });
  }
}

window.freeflow = {
  applyTheme,
  applyFontSize,
  setTimerMinutes,
};

init();
