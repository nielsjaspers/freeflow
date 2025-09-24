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
  persistPreferences,
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
let pendingDeleteId = null;

const WELCOME_NOTE = {
  title: 'welcome to freeflow',
  content: [
    'freeflow is a simple space for unfiltered writing.',
    '',
    'quick start:',
    '- tap the drawer icon to browse, create, or remove notes.',
    '- write freely in the main canvas; everything saves automatically to this device.',
    '- adjust the font size with the slider below and reset it with the arrow button.',
    '- set a focus timer, press play, pause when you need a breather, or stop to reset.',
    '',
    'no accounts, no syncing. just type and enjoy the flow!'
  ].join('\n'),
};

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
    const welcomeNote = buildNewNote(WELCOME_NOTE);
    state.notes.push(welcomeNote);
    state.activeNoteId = welcomeNote.id;
    persistNotes();
  } else {
    const preferredId = state.preferences.activeNoteId;
    const hasPreferred = preferredId && state.notes.some((note) => note.id === preferredId);
    state.activeNoteId = hasPreferred ? preferredId : state.notes[0].id;
  }

  renderNoteList();
  renderActiveNote();

  bindEvents();
  updateResponsivePlacements();
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

  dom.confirmDelete?.addEventListener('click', handleConfirmDelete);
  dom.confirmCancel?.addEventListener('click', hideDeleteConfirm);
  dom.modalBackdrop?.addEventListener('click', hideDeleteConfirm);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.confirmModal && !dom.confirmModal.hidden) {
      hideDeleteConfirm();
    }
  });

  const onViewportChange = () => {
    handleViewportChange();
    updateResponsivePlacements();
  };

  if (typeof mobileMediaQuery.addEventListener === 'function') {
    mobileMediaQuery.addEventListener('change', onViewportChange);
  } else {
    mobileMediaQuery.addListener(onViewportChange);
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
    requestDelete(noteId);
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
  updateResponsivePlacements();
}

function collapseSidebarForMobile() {
  if (mobileMediaQuery.matches) {
    setSidebarCollapsed(true, { persist: false, remember: false });
    updateResponsivePlacements();
  }
}

function requestDelete(noteId) {
  if (state.preferences.skipDeleteConfirm) {
    finalizeDelete(noteId);
    return;
  }

  pendingDeleteId = noteId;
  if (dom.confirmModal) {
    const note = state.notes.find((item) => item.id === noteId);
    dom.confirmMessage.textContent = note
      ? `Are you sure you want to delete “${note.title.trim() || 'Untitled note'}”?`
      : 'Are you sure you want to delete this note?';
    if (dom.confirmSkip) {
      dom.confirmSkip.checked = false;
    }
    dom.confirmModal.hidden = false;
    document.body.style.overflow = 'hidden';
    dom.confirmDelete?.focus();
  }
}

function hideDeleteConfirm() {
  if (dom.confirmModal) {
    dom.confirmModal.hidden = true;
  }
  pendingDeleteId = null;
  const shouldLockBody = mobileMediaQuery.matches && !state.ui.sidebarCollapsed;
  document.body.style.overflow = shouldLockBody ? 'hidden' : '';
}

function handleConfirmDelete() {
  if (pendingDeleteId) {
    const skipFurther = Boolean(dom.confirmSkip?.checked);
    if (skipFurther) {
      state.preferences.skipDeleteConfirm = true;
      persistPreferences({ skipDeleteConfirm: true });
    }
    const id = pendingDeleteId;
    hideDeleteConfirm();
    finalizeDelete(id);
  } else {
    hideDeleteConfirm();
  }
}

function finalizeDelete(noteId) {
  deleteNote(noteId);
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
    updateResponsivePlacements();
  }
}

function updateResponsivePlacements() {
  const isMobile = mobileMediaQuery.matches;

  if (dom.darkModeToggle && dom.editorMetaRow && dom.editorActions) {
    if (isMobile) {
      if (dom.darkModeToggle.parentElement !== dom.editorMetaRow) {
        dom.editorMetaRow.appendChild(dom.darkModeToggle);
      }
      dom.editorMetaRow.classList.add('editor__meta-row--stacked');
    } else {
      if (dom.darkModeToggle.parentElement !== dom.editorActions) {
        dom.editorActions.appendChild(dom.darkModeToggle);
      }
      dom.editorMetaRow.classList.remove('editor__meta-row--stacked');
    }
  }
}

window.freeflow = {
  applyTheme,
  applyFontSize,
  setTimerMinutes,
};

init();
