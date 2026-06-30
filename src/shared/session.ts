/**
 * Pure facts derived from a SessionState at a moment in time. Shared by the
 * background machine, the popup views, and the content-script mask so the same
 * rule is defined once instead of re-implemented per context.
 */
import { PACKS } from './constants';
import type { SessionState, Settings } from './types';

/** Break is in progress (running, or paused mid-break). */
export function inBreak(state: SessionState): boolean {
  return (
    state.phase === 'break' ||
    (state.phase === 'paused' && state.pausedFrom === 'break')
  );
}

/** Milliseconds left in the current phase; a pause reads its banked remainder. */
export function phaseRemainingMs(state: SessionState, now: number): number {
  return state.phase === 'paused'
    ? state.pausedRemainingMs
    : Math.max(0, state.phaseEndsAt - now);
}

/** Remaining fraction of the current phase as a 0–100 percentage — the value
    the depleting progress bars render as their width. */
export function phaseRemainingPct(state: SessionState, now: number): number {
  if (state.phaseDurationMs <= 0) return 0;
  return (phaseRemainingMs(state, now) / state.phaseDurationMs) * 100;
}

/** The configured pack has an ambient track at all (independent of the toggle). */
export function hasAmbientTrack(settings: Settings): boolean {
  return PACKS[settings.sound].ambient !== null;
}

/** Ambient audio should be playing / named for this run: a track exists and the
    user left it on. */
export function ambientAudible(state: SessionState): boolean {
  return state.ambientOn && hasAmbientTrack(state.settings);
}
