import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { idleState } from './state';
import type { SessionState, Settings } from './types';
import {
  badgeText,
  breakAfter,
  breakDurationMs,
  fmtCountdown,
  fmtFinishAt,
  focusDurationMs,
  minuteMs,
  planTotalMs,
  remainingRunMs,
} from './schedule';

const MIN = 60_000;

// Fixtures build on the real defaults / factories so a type change surfaces
// here too, instead of re-declaring the SessionState / Settings shape.
const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

const state = (over: Partial<SessionState> = {}): SessionState => ({
  ...idleState(settings()),
  ...over,
});

describe('minuteMs', () => {
  it('is a real minute by default', () => {
    expect(minuteMs(settings())).toBe(60_000);
  });

  it('compresses to one second in test mode', () => {
    expect(minuteMs(settings({ testMode: true }))).toBe(1000);
  });
});

describe('breakAfter', () => {
  it('returns null after the final session (no trailing break)', () => {
    expect(breakAfter(4, 4, settings())).toBeNull();
    expect(breakAfter(5, 4, settings())).toBeNull();
  });

  it('is a short break on non-interval sessions', () => {
    expect(breakAfter(1, 5, settings())).toBe('short');
    expect(breakAfter(2, 5, settings())).toBe('short');
    expect(breakAfter(3, 5, settings())).toBe('short');
  });

  it('is a long break on every Nth session', () => {
    expect(breakAfter(4, 5, settings())).toBe('long');
    expect(breakAfter(4, 8, settings({ longBreakInterval: 4 }))).toBe('long');
    expect(breakAfter(3, 8, settings({ longBreakInterval: 3 }))).toBe('long');
  });

  it('never long when long breaks are disabled', () => {
    expect(breakAfter(4, 8, settings({ longBreakEnabled: false }))).toBe(
      'short'
    );
  });

  it('does not turn the last break long even on an interval boundary', () => {
    // 4 sessions, interval 4: session 4 is the last, so it has no break at all.
    expect(breakAfter(4, 4, settings())).toBeNull();
  });
});

describe('duration helpers', () => {
  it('focus duration scales with the minute unit', () => {
    expect(focusDurationMs(settings())).toBe(25 * MIN);
    expect(focusDurationMs(settings({ testMode: true }))).toBe(25 * 1000);
  });

  it('break duration depends on kind', () => {
    expect(breakDurationMs('short', settings())).toBe(5 * MIN);
    expect(breakDurationMs('long', settings())).toBe(15 * MIN);
  });
});

describe('planTotalMs', () => {
  it('is just one focus block for a single session (no breaks)', () => {
    expect(planTotalMs(1, settings())).toBe(25 * MIN);
  });

  it('sums focus + interleaved short breaks (long never triggers in 4)', () => {
    // 4 × 25 focus + 3 short breaks (after sessions 1–3) = 100 + 15.
    expect(planTotalMs(4, settings())).toBe(115 * MIN);
  });

  it('includes the long break once it actually falls due', () => {
    // 5 sessions: breaks after 1,2,3 (short) + 4 (long) = 5+5+5+15 = 30.
    expect(planTotalMs(5, settings())).toBe((125 + 30) * MIN);
  });

  it('uses only short breaks when long breaks are off', () => {
    expect(planTotalMs(5, settings({ longBreakEnabled: false }))).toBe(
      (125 + 20) * MIN
    );
  });

  it('compresses in test mode', () => {
    expect(planTotalMs(4, settings({ testMode: true }))).toBe(115 * 1000);
  });
});

describe('remainingRunMs', () => {
  it('focus: phase remainder + every following break and focus', () => {
    const s = state({
      phase: 'focus',
      currentSession: 1,
      totalSessions: 2,
      phaseEndsAt: 10 * MIN,
    });
    // 10 (left in focus) + 5 (break after s1) + 25 (s2 focus) = 40.
    expect(remainingRunMs(s, 0)).toBe(40 * MIN);
  });

  it('break: remaining break + the focus it leads into', () => {
    const s = state({
      phase: 'break',
      currentSession: 1,
      totalSessions: 2,
      phaseEndsAt: 3 * MIN,
    });
    // 3 (left in break) + 25 (next focus) = 28.
    expect(remainingRunMs(s, 0)).toBe(28 * MIN);
  });

  it('waiting: just the upcoming focus (no phase remainder)', () => {
    const s = state({ phase: 'waiting', currentSession: 1, totalSessions: 2 });
    expect(remainingRunMs(s, 0)).toBe(25 * MIN);
  });

  it('paused: uses the frozen remainder like focus', () => {
    const s = state({
      phase: 'paused',
      pausedFrom: 'focus',
      pausedRemainingMs: 8 * MIN,
      currentSession: 1,
      totalSessions: 2,
    });
    // 8 (frozen) + 5 (break) + 25 (focus) = 38.
    expect(remainingRunMs(s, 0)).toBe(38 * MIN);
  });
});

describe('fmtCountdown', () => {
  it('formats whole minutes', () => {
    expect(fmtCountdown(25 * MIN)).toBe('25:00');
    expect(fmtCountdown(61_000)).toBe('01:01');
  });

  it('rounds up partial seconds (ceil)', () => {
    expect(fmtCountdown(500)).toBe('00:01');
    expect(fmtCountdown(59_400)).toBe('01:00');
  });

  it('clamps at zero for non-positive input', () => {
    expect(fmtCountdown(0)).toBe('00:00');
    expect(fmtCountdown(-5000)).toBe('00:00');
  });
});

describe('fmtFinishAt', () => {
  // Built with local-time Date constructors on both sides, so assertions are
  // timezone-independent.
  const at = (h: number, m: number) =>
    new Date(2026, 0, 1, h, m, 0, 0).getTime();

  it('adds the remaining span to the wall clock', () => {
    expect(fmtFinishAt(at(9, 0), 90 * MIN)).toBe('10:30');
  });

  it('carries across the hour', () => {
    expect(fmtFinishAt(at(9, 45), 30 * MIN)).toBe('10:15');
  });

  it('zero-pads hours and minutes', () => {
    expect(fmtFinishAt(at(8, 5), 0)).toBe('08:05');
  });
});

describe('badgeText', () => {
  it('floors to whole minutes', () => {
    expect(badgeText(25 * MIN, MIN)).toBe('25m');
    expect(badgeText(90_000, MIN)).toBe('1m'); // 1.5 min floors to 1
  });

  it('shows "<1m" in the final sub-minute instead of "0m"', () => {
    expect(badgeText(MIN - 1, MIN)).toBe('<1m');
    expect(badgeText(0, MIN)).toBe('<1m');
    expect(badgeText(-500, MIN)).toBe('<1m');
  });

  it('respects the test-mode unit (1s)', () => {
    expect(badgeText(3000, 1000)).toBe('3m');
    expect(badgeText(999, 1000)).toBe('<1m');
  });
});
