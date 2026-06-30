import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { idleState } from '../shared/state';
import type { SessionState, Settings } from '../shared/types';
import {
  afterBreak,
  afterFocus,
  breakState,
  completeState,
  focusState,
  nextFocusState,
  pausedState,
  phaseIsDue,
  resumedState,
  waitingState,
} from './machine';

const MIN = 60_000;
const NOW = 1_000_000;

// Reuse the real defaults / factories so a type change surfaces here too.
const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

const state = (over: Partial<SessionState> = {}): SessionState => ({
  ...idleState(settings()),
  ...over,
});

describe('focusState', () => {
  it('opens session 1 of a fresh run with the focus duration', () => {
    const s = focusState(settings(), 4, true, NOW);
    expect(s.phase).toBe('focus');
    expect(s.currentSession).toBe(1);
    expect(s.totalSessions).toBe(4);
    expect(s.phaseDurationMs).toBe(25 * MIN);
    expect(s.phaseEndsAt).toBe(NOW + 25 * MIN);
    expect(s.ambientOn).toBe(true);
    expect(s.maskHidden).toBe(false);
    expect(s.muted).toBe(false);
  });

  it('carries the ambient choice through', () => {
    expect(focusState(settings(), 1, false, NOW).ambientOn).toBe(false);
  });
});

describe('breakState', () => {
  it('is a short break on a non-interval boundary, sized to breakMin', () => {
    const s = breakState(
      state({ phase: 'focus', currentSession: 1, totalSessions: 4 }),
      NOW
    );
    expect(s.phase).toBe('break');
    expect(s.breakKind).toBe('short');
    expect(s.phaseDurationMs).toBe(5 * MIN);
    expect(s.phaseEndsAt).toBe(NOW + 5 * MIN);
    expect(s.maskHidden).toBe(false);
  });

  it('is a long break on the interval boundary', () => {
    const s = breakState(
      state({ phase: 'focus', currentSession: 4, totalSessions: 8 }),
      NOW
    );
    expect(s.breakKind).toBe('long');
    expect(s.phaseDurationMs).toBe(15 * MIN);
  });
});

describe('waitingState', () => {
  it('drops the phase timer (handshake has no countdown)', () => {
    const s = waitingState(state({ phase: 'break', phaseEndsAt: NOW }));
    expect(s.phase).toBe('waiting');
    expect(s.phaseEndsAt).toBe(0);
    expect(s.phaseDurationMs).toBe(0);
  });
});

describe('nextFocusState', () => {
  it('advances the session counter and re-arms a focus block', () => {
    const s = nextFocusState(
      state({ phase: 'waiting', currentSession: 1, totalSessions: 3 }),
      NOW
    );
    expect(s.phase).toBe('focus');
    expect(s.currentSession).toBe(2);
    expect(s.phaseEndsAt).toBe(NOW + 25 * MIN);
    expect(s.maskHidden).toBe(false);
  });
});

describe('completeState', () => {
  it('is a terminal screen carrying the run totals', () => {
    const s = completeState(state({ totalSessions: 4, currentSession: 2 }));
    expect(s.phase).toBe('complete');
    expect(s.totalSessions).toBe(4);
    expect(s.currentSession).toBe(4);
  });
});

describe('pausedState / resumedState', () => {
  it('banks the remaining time and restores it on resume', () => {
    const focus = state({
      phase: 'focus',
      phaseEndsAt: NOW + 8 * MIN,
    });
    const paused = pausedState(focus, NOW);
    expect(paused.phase).toBe('paused');
    expect(paused.pausedFrom).toBe('focus');
    expect(paused.pausedRemainingMs).toBe(8 * MIN);
    expect(paused.phaseEndsAt).toBe(0);

    const resumed = resumedState(paused, NOW + 100 * MIN);
    expect(resumed.phase).toBe('focus');
    expect(resumed.phaseEndsAt).toBe(NOW + 108 * MIN);
    expect(resumed.pausedRemainingMs).toBe(0);
  });

  it('records a break pause and resumes back into break', () => {
    const paused = pausedState(
      state({ phase: 'break', phaseEndsAt: NOW + 2 * MIN }),
      NOW
    );
    expect(paused.pausedFrom).toBe('break');
    expect(resumedState(paused, NOW).phase).toBe('break');
  });

  it('never banks negative remainder for an overdue phase', () => {
    expect(
      pausedState(state({ phase: 'focus', phaseEndsAt: NOW - 5000 }), NOW)
        .pausedRemainingMs
    ).toBe(0);
  });
});

describe('phaseIsDue', () => {
  it('is due at/after the phase end (with a small slack), focus or break only', () => {
    expect(phaseIsDue(state({ phase: 'focus', phaseEndsAt: NOW }), NOW)).toBe(
      true
    );
    expect(
      phaseIsDue(state({ phase: 'focus', phaseEndsAt: NOW + 200 }), NOW)
    ).toBe(true); // within the 250ms slack
    expect(
      phaseIsDue(state({ phase: 'focus', phaseEndsAt: NOW + 1000 }), NOW)
    ).toBe(false);
    expect(
      phaseIsDue(state({ phase: 'waiting', phaseEndsAt: NOW - 1000 }), NOW)
    ).toBe(false);
  });
});

describe('afterFocus', () => {
  it('completes the run on the last session, else takes a break', () => {
    expect(afterFocus(state({ currentSession: 4, totalSessions: 4 }))).toBe(
      'complete'
    );
    expect(afterFocus(state({ currentSession: 2, totalSessions: 4 }))).toBe(
      'break'
    );
  });
});

describe('afterBreak', () => {
  it('skips the wake handshake when the mask was hidden', () => {
    expect(afterBreak(state({ maskHidden: true }))).toBe('focus');
    expect(afterBreak(state({ maskHidden: false }))).toBe('waiting');
  });
});
