import {
  DEFAULT_TIMER_MINUTES,
  MIN_TIMER_MINUTES,
  MAX_TIMER_MINUTES,
  TIMER_TICK_MS,
} from './constants.js';
import { state, timerState } from './state.js';
import { dom } from './dom.js';
import { persistPreferences } from './storage.js';
import { clamp } from './utils.js';

export function setTimerMinutes(minutes, options = {}) {
  const { persist = true } = options;
  const numeric = Number(minutes);
  const valid = Number.isFinite(numeric) ? Math.round(numeric) : DEFAULT_TIMER_MINUTES;
  const clamped = clamp(valid, MIN_TIMER_MINUTES, MAX_TIMER_MINUTES);

  timerState.durationMs = clamped * 60000;
  if (!timerState.isRunning) {
    timerState.remainingMs = timerState.durationMs;
    updateTimerDisplay(timerState.remainingMs);
    if (dom.timerDisplay) {
      dom.timerDisplay.classList.remove('is-complete');
    }
    if (dom.timerToggle) {
      dom.timerToggle.textContent = 'Start timer';
      dom.timerToggle.setAttribute('aria-pressed', 'false');
    }
  }

  if (dom.timerMinutesInput) {
    dom.timerMinutesInput.value = clamped;
  }

  if (persist) {
    persistPreferences({ timerMinutes: clamped });
  } else {
    state.preferences.timerMinutes = clamped;
  }
}

export function onTimerToggle() {
  if (timerState.isRunning) {
    stopTimer();
    return;
  }
  startTimer();
}

export function onTimerMinutesInput(event) {
  if (timerState.isRunning) return;
  setTimerMinutes(event.target.value, { persist: false });
}

export function onTimerMinutesChange(event) {
  if (timerState.isRunning) {
    if (dom.timerMinutesInput) {
      dom.timerMinutesInput.value = Math.round(timerState.durationMs / 60000);
    }
    return;
  }
  setTimerMinutes(event.target.value, { persist: true });
}

export function stopTimer(options = {}) {
  const { completed = false } = options;
  if (timerState.intervalId) {
    window.clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.isRunning = false;
  if (dom.timerToggle) {
    dom.timerToggle.setAttribute('aria-pressed', 'false');
    dom.timerToggle.textContent = 'Start timer';
  }
  if (dom.timerMinutesInput) {
    dom.timerMinutesInput.disabled = false;
  }
  if (dom.timerDisplay) {
    dom.timerDisplay.classList.remove('is-active');
  }

  if (completed) {
    timerState.remainingMs = 0;
    updateTimerDisplay(timerState.remainingMs);
    if (dom.timerDisplay) {
      dom.timerDisplay.classList.add('is-complete');
    }
  } else {
    resetTimer();
  }
}

function startTimer() {
  if (timerState.isRunning) return;
  const minutes = Number(dom.timerMinutesInput?.value) || state.preferences.timerMinutes || DEFAULT_TIMER_MINUTES;
  setTimerMinutes(minutes, { persist: true });
  timerState.remainingMs = timerState.durationMs;
  timerState.targetTimestamp = Date.now() + timerState.remainingMs;
  timerState.intervalId = window.setInterval(tickTimer, TIMER_TICK_MS);
  timerState.isRunning = true;
  if (dom.timerToggle) {
    dom.timerToggle.textContent = 'Stop timer';
    dom.timerToggle.setAttribute('aria-pressed', 'true');
  }
  if (dom.timerMinutesInput) {
    dom.timerMinutesInput.disabled = true;
  }
  if (dom.timerDisplay) {
    dom.timerDisplay.classList.add('is-active');
    dom.timerDisplay.classList.remove('is-complete');
  }
}

function resetTimer() {
  timerState.remainingMs = timerState.durationMs;
  updateTimerDisplay(timerState.remainingMs);
  if (dom.timerDisplay) {
    dom.timerDisplay.classList.remove('is-complete');
  }
  if (dom.timerToggle) {
    dom.timerToggle.textContent = 'Start timer';
    dom.timerToggle.setAttribute('aria-pressed', 'false');
  }
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
  if (dom.timerDisplay && typeof dom.timerDisplay.focus === 'function') {
    dom.timerDisplay.focus();
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(200);
  }
}

function updateTimerDisplay(ms) {
  if (!dom.timerDisplay) return;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  dom.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
