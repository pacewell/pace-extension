import type { Settings } from './types';

/* User-facing copy builders — pure functions, no DOM, no chrome. Centralized
   here so the wording lives in one place (and as the seed for a later i18n
   pass). Static markup text still lives in popup.html for now. */

/** "session" / "sessions" — the unit under the planning hero number. */
export function sessionUnit(n: number): string {
  return n === 1 ? 'session' : 'sessions';
}

/** "Session 3 of 4" — the progress line shared by the working, breaking, and
    waiting views (each passes the session number it wants to show). */
export function progressLabel(session: number, total: number): string {
  return `Session ${session} of ${total}`;
}

/** A whole-minute total as human time: "45 min", "1h", "1h 40m". */
export function fmtDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** The one-time cadence sentence in the planning "sessions" tooltip. */
export function rhythmText(s: Settings): string {
  return (
    `Each session is ${s.focusMin} min of focus, then a ${s.breakMin} min break.` +
    (s.longBreakEnabled
      ? ` After every ${s.longBreakInterval} sessions, a longer ${s.longBreakMin} min break.`
      : '')
  );
}

/** Completion-screen summary, e.g. "4 sessions · 1h 40m of focus". */
export function completeSummary(sessions: number, s: Settings): string {
  return `${sessions} ${sessionUnit(sessions)} · ${fmtDuration(
    sessions * s.focusMin
  )} of focus`;
}
