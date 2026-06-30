import type { BreakKind, SessionState, Settings } from './types';

/** One product "minute" in ms; the dev test mode compresses it to one second.
    `__ENABLE_TEST_MODE__` is false in the store build, so this collapses to the
    real-time path (and dead-code-eliminates the compression) regardless of any
    stale persisted `testMode`. */
export function minuteMs(s: Settings): number {
  return __ENABLE_TEST_MODE__ && s.testMode ? 1000 : 60_000;
}

/** Which break follows the given session, or null after the last session. */
export function breakAfter(
  session: number,
  total: number,
  s: Settings
): BreakKind | null {
  if (session >= total) return null;
  return s.longBreakEnabled && session % s.longBreakInterval === 0
    ? 'long'
    : 'short';
}

export function breakDurationMs(kind: BreakKind, s: Settings): number {
  return (kind === 'long' ? s.longBreakMin : s.breakMin) * minuteMs(s);
}

function breakMsAfter(session: number, total: number, s: Settings): number {
  const kind = breakAfter(session, total, s);
  return kind ? breakDurationMs(kind, s) : 0;
}

export function focusDurationMs(s: Settings): number {
  return s.focusMin * minuteMs(s);
}

/** Total run length for the planning screen. */
export function planTotalMs(sessions: number, s: Settings): number {
  let total = sessions * focusDurationMs(s);
  for (let i = 1; i < sessions; i++) total += breakMsAfter(i, sessions, s);
  return total;
}

/** Remaining time until the whole run completes, given the live state. */
export function remainingRunMs(state: SessionState, now: number): number {
  const s = state.settings;
  const focusMs = focusDurationMs(s);
  const phaseRemaining =
    state.phase === 'paused'
      ? state.pausedRemainingMs
      : Math.max(0, state.phaseEndsAt - now);
  let total = 0;
  if (state.phase === 'focus' || state.phase === 'paused') {
    total += phaseRemaining;
    for (let i = state.currentSession; i < state.totalSessions; i++) {
      total += breakMsAfter(i, state.totalSessions, s) + focusMs;
    }
  } else if (state.phase === 'break' || state.phase === 'waiting') {
    if (state.phase === 'break') total += phaseRemaining;
    total += focusMs;
    for (let i = state.currentSession + 1; i < state.totalSessions; i++) {
      total += breakMsAfter(i, state.totalSessions, s) + focusMs;
    }
  }
  return total;
}

const pad = (n: number): string => n.toString().padStart(2, '0');

/** "24:59" style countdown. */
export function fmtCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(totalSec / 60))}:${pad(totalSec % 60)}`;
}

/** "16:30" style wall-clock time for `now + remainingMs`. */
export function fmtFinishAt(now: number, remainingMs: number): string {
  const d = new Date(now + remainingMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Toolbar badge label for a focus/break phase: whole minutes (floored), but the
    final sub-minute reads "<1m" rather than a misleading "0m" (a bare 0 reads as
    "finished" while time is still running). `unitMs` is `minuteMs(settings)`. */
export function badgeText(remainingMs: number, unitMs: number): string {
  const minutes = Math.floor(remainingMs / unitMs);
  return minutes <= 0 ? '<1m' : `${minutes}m`;
}
