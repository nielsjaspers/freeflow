import {
  STORAGE_KEY,
  PREFERENCES_KEY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TIMER_MINUTES,
  MIN_TIMER_MINUTES,
  MAX_TIMER_MINUTES,
} from './constants.js';
import { state } from './state.js';
import { clamp, generateId } from './utils.js';

export function loadNotes() {
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

export function persistNotes() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

export function loadPreferences() {
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
        sidebarCollapsed:
          typeof parsed.sidebarCollapsed === 'boolean' ? parsed.sidebarCollapsed : null,
        showPolkaDots: typeof parsed.showPolkaDots === 'boolean' ? parsed.showPolkaDots : true,
        searchInTitle: typeof parsed.searchInTitle === 'boolean' ? parsed.searchInTitle : true,
        searchInContent: typeof parsed.searchInContent === 'boolean' ? parsed.searchInContent : true,
        skipDeleteConfirm: typeof parsed.skipDeleteConfirm === 'boolean' ? parsed.skipDeleteConfirm : false,
      };
    }
  } catch (error) {
    console.error('Failed to load preferences', error);
  }
}

export function persistPreferences(partial) {
  state.preferences = {
    ...state.preferences,
    ...partial,
  };
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.preferences));
}
