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
  applyPolkaDots(state.preferences.showPolkaDots, { persist: false, updateUI: false });
  setDeleteModalPreference(!state.preferences.skipDeleteConfirm, { persist: false, updateUI: false });
  setSearchPreference('searchInTitle', state.preferences.searchInTitle, {
    persist: false,
    updateUI: false,
    reRender: false,
  });
  setSearchPreference('searchInContent', state.preferences.searchInContent, {
    persist: false,
    updateUI: false,
    reRender: false,
  });

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
  updateSearchVisibility();
  updateBodyScrollLock();
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
  dom.appOverlay?.addEventListener('click', () => {
    setSidebarCollapsed(true, { persist: !mobileMediaQuery.matches, remember: !mobileMediaQuery.matches });
    updateResponsivePlacements();
    updateBodyScrollLock();
  });

  dom.settingsOpen?.addEventListener('click', openSettings);
  dom.settingsClose?.addEventListener('click', closeSettings);
  dom.settingsBackdrop?.addEventListener('click', closeSettings);
  dom.toggleDots?.addEventListener('change', (event) => applyPolkaDots(event.target.checked));
  dom.toggleDeleteModal?.addEventListener('change', (event) =>
    setDeleteModalPreference(event.target.checked)
  );
  dom.toggleSearchTitle?.addEventListener('change', (event) =>
    setSearchPreference('searchInTitle', event.target.checked)
  );
  dom.toggleSearchContent?.addEventListener('change', (event) =>
    setSearchPreference('searchInContent', event.target.checked)
  );
  dom.exportNotes?.addEventListener('click', handleExportNotes);
  dom.importNotes?.addEventListener('click', () => dom.importInput?.click());
  dom.importInput?.addEventListener('change', handleImportInput);
  dom.deleteAllBtn?.addEventListener('click', openDangerModal);

  dom.confirmDelete?.addEventListener('click', handleConfirmDelete);
  dom.confirmCancel?.addEventListener('click', hideDeleteConfirm);
  dom.modalBackdrop?.addEventListener('click', hideDeleteConfirm);

  dom.dangerCancel?.addEventListener('click', closeDangerModal);
  dom.dangerBackdrop?.addEventListener('click', closeDangerModal);
  dom.dangerInput?.addEventListener('input', handleDangerInput);
  dom.dangerConfirm?.addEventListener('click', handleDangerConfirm);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (dom.dangerModal && !dom.dangerModal.hidden) {
        closeDangerModal();
        return;
      }
      if (dom.confirmModal && !dom.confirmModal.hidden) {
        hideDeleteConfirm();
        return;
      }
      if (dom.settingsModal && !dom.settingsModal.hidden) {
        closeSettings();
      }
    }
  });

  const onViewportChange = () => {
    handleViewportChange();
    updateResponsivePlacements();
    updateBodyScrollLock();
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
  if (!(state.preferences.searchInTitle || state.preferences.searchInContent)) {
    event.target.value = '';
    return;
  }
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
  updateBodyScrollLock();
}

function collapseSidebarForMobile() {
  if (mobileMediaQuery.matches) {
    setSidebarCollapsed(true, { persist: false, remember: false });
    updateResponsivePlacements();
    updateBodyScrollLock();
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
    dom.confirmDelete?.focus();
  }
  updateBodyScrollLock();
}

function hideDeleteConfirm() {
  if (dom.confirmModal) {
    dom.confirmModal.hidden = true;
  }
  pendingDeleteId = null;
  updateBodyScrollLock();
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

function openSettings() {
  if (!dom.settingsModal) return;
  syncSettingsUI();
  dom.settingsModal.hidden = false;
  state.ui.settingsOpen = true;
  updateBodyScrollLock();
  dom.toggleDots?.focus();
}

function closeSettings() {
  if (!dom.settingsModal) return;
  dom.settingsModal.hidden = true;
  state.ui.settingsOpen = false;
  updateBodyScrollLock();
}

function applyPolkaDots(enabled, options = {}) {
  const { persist = true, updateUI = true } = options;
  const value = Boolean(enabled);
  document.body.classList.toggle('no-note-dots', !value);
  document.documentElement.classList.toggle('no-note-dots', !value);
  state.preferences.showPolkaDots = value;
  if (updateUI && dom.toggleDots) {
    dom.toggleDots.checked = value;
  }
  if (persist) {
    persistPreferences({ showPolkaDots: value });
  }
}

function setDeleteModalPreference(showModal, options = {}) {
  const { persist = true, updateUI = true } = options;
  const skip = !showModal;
  state.preferences.skipDeleteConfirm = skip;
  if (updateUI && dom.toggleDeleteModal) {
    dom.toggleDeleteModal.checked = showModal;
  }
  if (persist) {
    persistPreferences({ skipDeleteConfirm: skip });
  }
}

function setSearchPreference(key, value, options = {}) {
  const { persist = true, updateUI = true, reRender = true } = options;
  const normalized = Boolean(value);
  if (!(key === 'searchInTitle' || key === 'searchInContent')) return;
  state.preferences[key] = normalized;
  if (persist) {
    persistPreferences({ [key]: normalized });
  }
  if (updateUI) {
    if (key === 'searchInTitle' && dom.toggleSearchTitle) {
      dom.toggleSearchTitle.checked = normalized;
    }
    if (key === 'searchInContent' && dom.toggleSearchContent) {
      dom.toggleSearchContent.checked = normalized;
    }
  }
  updateSearchVisibility();
  if (reRender) {
    renderNoteList();
  }
}

function updateSearchVisibility() {
  const enabled = state.preferences.searchInTitle || state.preferences.searchInContent;
  const container = dom.searchInput?.closest('.sidebar__search');
  if (container) {
    container.hidden = !enabled;
  }
  if (dom.searchInput) {
    dom.searchInput.disabled = !enabled;
  }
  if (!enabled) {
    state.searchQuery = '';
    if (dom.searchInput) {
      dom.searchInput.value = '';
    }
    renderNoteList();
  }
}

function syncSettingsUI() {
  if (dom.toggleDots) {
    dom.toggleDots.checked = Boolean(state.preferences.showPolkaDots);
  }
  if (dom.toggleDeleteModal) {
    dom.toggleDeleteModal.checked = !state.preferences.skipDeleteConfirm;
  }
  if (dom.toggleSearchTitle) {
    dom.toggleSearchTitle.checked = Boolean(state.preferences.searchInTitle);
  }
  if (dom.toggleSearchContent) {
    dom.toggleSearchContent.checked = Boolean(state.preferences.searchInContent);
  }
}

function handleImportInput(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const noteData = JSON.parse(reader.result);
      if (!noteData || typeof noteData !== 'object') {
        throw new Error('Invalid note file');
      }
      const imported = buildNewNote({
        title: typeof noteData.title === 'string' ? noteData.title : 'Imported note',
        content: typeof noteData.content === 'string' ? noteData.content : '',
      });
      state.notes.unshift(imported);
      changeActiveNote(imported.id);
      persistNotes();
      renderNoteList();
      renderActiveNote();
      dom.noteList?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('freeflow: failed to import note', error);
    } finally {
      if (dom.importInput) {
        dom.importInput.value = '';
      }
    }
  };
  reader.onerror = () => {
    console.error('freeflow: failed to read imported file');
    if (dom.importInput) {
      dom.importInput.value = '';
    }
  };
  reader.readAsText(file);
}

function handleExportNotes() {
  if (!state.notes.length) {
    return;
  }
  const encoder = new TextEncoder();
  const entries = state.notes.map((note, index) => {
    const basename = `note-${String(index + 1).padStart(3, '0')}.json`;
    const payload = JSON.stringify(
      {
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt,
      },
      null,
      2,
    );
    return {
      name: basename,
      data: encoder.encode(payload),
    };
  });

  const zipBlob = createZipFromEntries(entries);
  const timestamp = new Date().toISOString().slice(0, 10);
  triggerDownload(zipBlob, `freeflow-notes-${timestamp}.zip`);
}

function openDangerModal() {
  closeSettings();
  if (!dom.dangerModal) return;
  dom.dangerModal.hidden = false;
  dom.dangerInput.value = '';
  dom.dangerConfirm.disabled = true;
  dom.dangerInput.focus();
  updateBodyScrollLock();
}

function closeDangerModal() {
  if (!dom.dangerModal) return;
  dom.dangerModal.hidden = true;
  dom.dangerInput.value = '';
  dom.dangerConfirm.disabled = true;
  updateBodyScrollLock();
}

function handleDangerInput(event) {
  const value = event.target.value.trim().toUpperCase();
  const valid = value === 'DELETE';
  if (dom.dangerConfirm) {
    dom.dangerConfirm.disabled = !valid;
  }
}

function handleDangerConfirm() {
  if (!dom.dangerInput) return;
  const value = dom.dangerInput.value.trim().toUpperCase();
  if (value !== 'DELETE') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
  } catch (error) {
    console.error('freeflow: failed to clear storage', error);
  }
  closeDangerModal();
  window.location.reload();
}

function updateBodyScrollLock() {
  const lockSidebar = mobileMediaQuery.matches && !state.ui.sidebarCollapsed;
  const lockConfirm = dom.confirmModal && !dom.confirmModal.hidden;
  const lockSettings = dom.settingsModal && !dom.settingsModal.hidden;
  const lockDanger = dom.dangerModal && !dom.dangerModal.hidden;
  const shouldLock = lockSidebar || lockConfirm || lockSettings || lockDanger;
  document.body.style.overflow = shouldLock ? 'hidden' : '';
}

function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function createZipFromEntries(entries) {
  const textEncoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes =
      typeof entry.name === 'string' ? textEncoder.encode(entry.name) : new Uint8Array(entry.name);
    const dataBytes = entry.data instanceof Uint8Array ? entry.data : textEncoder.encode(String(entry.data));
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc >>> 0, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localChunks.push(localHeader);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc >>> 0, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    offset += localHeader.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localChunks, ...centralChunks, end], { type: 'application/zip' });
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
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
    updateBodyScrollLock();
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
