import {
  DEFAULT_FONT_SIZE,
  DEFAULT_TIMER_MINUTES,
  MOBILE_BREAKPOINT,
} from './constants.js';

export const state = {
  notes: [],
  activeNoteId: null,
  searchQuery: '',
  preferences: {
    darkMode: null,
    fontSize: DEFAULT_FONT_SIZE,
    activeNoteId: null,
    timerMinutes: DEFAULT_TIMER_MINUTES,
    sidebarCollapsed: null,
    showPolkaDots: true,
    searchInTitle: true,
    searchInContent: true,
    skipDeleteConfirm: false,
  },
  ui: {
    sidebarCollapsed: false,
    settingsOpen: false,
  },
};

export const timerState = {
  durationMs: DEFAULT_TIMER_MINUTES * 60000,
  remainingMs: DEFAULT_TIMER_MINUTES * 60000,
  targetTimestamp: null,
  intervalId: null,
  isRunning: false,
  isActive: false,
};

export const mobileMediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
