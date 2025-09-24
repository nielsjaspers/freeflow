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
    timerState.targetTimestamp = null;
    timerState.isActive = false;
    updateTimerDisplay(timerState.remainingMs);
    dom.timerDisplay?.classList.remove('is-complete');
    updateTimerControls();
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
    pauseTimer();
  } else {
    resumeTimer();
  }
}

export function onTimerStop() {
  if (!timerState.isRunning && !timerState.isActive) {
    resetTimerState();
    updateTimerControls();
    return;
  }
  stopTimer();
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

function resumeTimer() {
  timerState.remainingMs = Math.max(0, timerState.remainingMs || timerState.durationMs);
  timerState.targetTimestamp = Date.now() + timerState.remainingMs;
  timerState.intervalId = window.setInterval(tickTimer, TIMER_TICK_MS);
  timerState.isRunning = true;
  timerState.isActive = true;
  dom.timerDisplay?.classList.remove('is-complete');
  updateTimerControls();
}

function pauseTimer() {
  if (!timerState.isRunning) return;
  if (timerState.intervalId) {
    window.clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.remainingMs = Math.max(0, timerState.targetTimestamp - Date.now());
  timerState.targetTimestamp = null;
  timerState.isRunning = false;
  timerState.isActive = true;
  updateTimerControls();
}

function stopTimer(options = {}) {
  const { completed = false } = options;
  if (timerState.intervalId) {
    window.clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.isRunning = false;
  timerState.targetTimestamp = null;

  if (completed) {
    timerState.remainingMs = 0;
    timerState.isActive = false;
    updateTimerDisplay(timerState.remainingMs);
    dom.timerDisplay?.classList.add('is-complete');
  } else {
    resetTimerState();
  }

  updateTimerControls();
}

function resetTimerState() {
  timerState.remainingMs = timerState.durationMs;
  timerState.targetTimestamp = null;
  timerState.isRunning = false;
  timerState.isActive = false;
  updateTimerDisplay(timerState.remainingMs);
  dom.timerDisplay?.classList.remove('is-complete');
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

function updateTimerControls() {
  const stateName = timerState.isRunning ? 'running' : timerState.isActive ? 'paused' : 'idle';

  if (dom.timerToggle) {
    const label = stateName === 'running' ? 'Pause timer' : stateName === 'paused' ? 'Resume timer' : 'Start timer';
    dom.timerToggle.dataset.state = timerState.isRunning ? 'playing' : 'paused';
    dom.timerToggle.setAttribute('aria-pressed', timerState.isRunning ? 'true' : 'false');
    dom.timerToggle.setAttribute('aria-label', label);
  }

  if (dom.timerMinutesInput) {
    dom.timerMinutesInput.disabled = timerState.isRunning;
  }

  if (dom.timerStop) {
    dom.timerStop.disabled = stateName === 'idle';
  }

  if (dom.timerDisplay) {
    dom.timerDisplay.classList.toggle('is-active', timerState.isRunning);
    if (!timerState.isRunning) {
      dom.timerDisplay.classList.remove('is-active');
    }
  }
}
