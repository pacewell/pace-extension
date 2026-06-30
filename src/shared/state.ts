import type { SessionState, Settings } from './types';

/** The idle (planning-screen) state for a given settings snapshot — the single
    blueprint for a "blank" run. Lives in shared (not the background) so the
    state machine and the unit tests build a SessionState the same way, rather
    than each hand-rolling the shape. */
export function idleState(settings: Settings): SessionState {
  return {
    phase: 'idle',
    totalSessions: 0,
    currentSession: 0,
    breakKind: 'short',
    phaseEndsAt: 0,
    phaseDurationMs: 0,
    pausedRemainingMs: 0,
    pausedFrom: 'focus',
    maskHidden: false,
    ambientOn: true,
    muted: false,
    settings,
  };
}
