/**
 * Pure state-machine transitions: each function takes the current SessionState
 * (and the wall clock as an explicit `now`) and returns the *next* state — no
 * I/O, no chrome, no module state. The effectful orchestration (persist, paint,
 * arm timers, play audio, push) lives in `index.ts`; this file is what makes the
 * phase logic unit-testable in isolation.
 */
import { breakAfter, breakDurationMs, focusDurationMs } from '../shared/schedule';
import { idleState } from '../shared/state';
import type { SessionState, Settings } from '../shared/types';

/** First focus of a fresh run. */
export function focusState(
  settings: Settings,
  sessions: number,
  ambientOn: boolean,
  now: number
): SessionState {
  const durationMs = focusDurationMs(settings);
  return {
    phase: 'focus',
    totalSessions: sessions,
    currentSession: 1,
    breakKind: 'short',
    phaseEndsAt: now + durationMs,
    phaseDurationMs: durationMs,
    pausedRemainingMs: 0,
    pausedFrom: 'focus',
    maskHidden: false,
    ambientOn,
    muted: false,
    settings,
  };
}

/** Focus → break: pick short/long for this boundary and size the phase. */
export function breakState(state: SessionState, now: number): SessionState {
  const kind =
    breakAfter(state.currentSession, state.totalSessions, state.settings) ??
    'short';
  const durationMs = breakDurationMs(kind, state.settings);
  return {
    ...state,
    phase: 'break',
    breakKind: kind,
    phaseDurationMs: durationMs,
    phaseEndsAt: now + durationMs,
    pausedRemainingMs: 0,
    maskHidden: false,
  };
}

/** Break → waiting (the mouse-move wake handshake; no phase timer). */
export function waitingState(state: SessionState): SessionState {
  return { ...state, phase: 'waiting', phaseEndsAt: 0, phaseDurationMs: 0 };
}

/** Into the next focus session. */
export function nextFocusState(state: SessionState, now: number): SessionState {
  const durationMs = focusDurationMs(state.settings);
  return {
    ...state,
    phase: 'focus',
    currentSession: state.currentSession + 1,
    phaseEndsAt: now + durationMs,
    phaseDurationMs: durationMs,
    pausedRemainingMs: 0,
    maskHidden: false,
  };
}

/** Terminal completion screen, carrying the run's totals for the popup. */
export function completeState(state: SessionState): SessionState {
  return {
    ...idleState(state.settings),
    phase: 'complete',
    totalSessions: state.totalSessions,
    currentSession: state.totalSessions,
  };
}

/** Freeze the live phase (focus/break) into paused, banking the remainder. */
export function pausedState(state: SessionState, now: number): SessionState {
  return {
    ...state,
    phase: 'paused',
    pausedFrom: state.phase === 'break' ? 'break' : 'focus',
    pausedRemainingMs: Math.max(0, state.phaseEndsAt - now),
    phaseEndsAt: 0,
  };
}

/** Unfreeze a paused run back into the phase it interrupted. */
export function resumedState(state: SessionState, now: number): SessionState {
  return {
    ...state,
    phase: state.pausedFrom,
    phaseEndsAt: now + state.pausedRemainingMs,
    pausedRemainingMs: 0,
  };
}

/** A focus/break phase whose timer has elapsed (small slack for timer jitter). */
export function phaseIsDue(state: SessionState, now: number): boolean {
  return (
    (state.phase === 'focus' || state.phase === 'break') &&
    state.phaseEndsAt <= now + 250
  );
}

/** What a focus phase advances into when its timer elapses. */
export function afterFocus(state: SessionState): 'complete' | 'break' {
  return state.currentSession >= state.totalSessions ? 'complete' : 'break';
}

/** What a break advances into: straight to the next focus when the user is
    already at the desk (mask hidden), else the wake handshake. */
export function afterBreak(state: SessionState): 'focus' | 'waiting' {
  return state.maskHidden ? 'focus' : 'waiting';
}
