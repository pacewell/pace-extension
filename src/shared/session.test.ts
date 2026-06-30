import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import {
  ambientAudible,
  hasAmbientTrack,
  inBreak,
  phaseRemainingMs,
  phaseRemainingPct,
} from './session';
import { idleState } from './state';
import type { SessionState, Settings } from './types';

const NOW = 1_000_000;

const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

const state = (over: Partial<SessionState> = {}): SessionState => ({
  ...idleState(settings()),
  ...over,
});

describe('inBreak', () => {
  it('is true during a break or a break-pause only', () => {
    expect(inBreak(state({ phase: 'break' }))).toBe(true);
    expect(inBreak(state({ phase: 'paused', pausedFrom: 'break' }))).toBe(true);
    expect(inBreak(state({ phase: 'paused', pausedFrom: 'focus' }))).toBe(false);
    expect(inBreak(state({ phase: 'focus' }))).toBe(false);
  });
});

describe('phaseRemainingMs', () => {
  it('counts down to the phase end while running', () => {
    expect(
      phaseRemainingMs(state({ phase: 'focus', phaseEndsAt: NOW + 5000 }), NOW)
    ).toBe(5000);
  });

  it('never goes negative past the end', () => {
    expect(
      phaseRemainingMs(state({ phase: 'focus', phaseEndsAt: NOW - 5000 }), NOW)
    ).toBe(0);
  });

  it('reads the banked remainder while paused', () => {
    expect(
      phaseRemainingMs(
        state({ phase: 'paused', pausedRemainingMs: 8000, phaseEndsAt: 0 }),
        NOW
      )
    ).toBe(8000);
  });
});

describe('phaseRemainingPct', () => {
  it('is the remaining fraction of the phase duration', () => {
    const s = state({
      phase: 'focus',
      phaseEndsAt: NOW + 5000,
      phaseDurationMs: 10_000,
    });
    expect(phaseRemainingPct(s, NOW)).toBe(50);
  });

  it('is zero when the phase has no duration (avoids divide-by-zero)', () => {
    expect(
      phaseRemainingPct(state({ phase: 'waiting', phaseDurationMs: 0 }), NOW)
    ).toBe(0);
  });
});

describe('ambient helpers', () => {
  it('hasAmbientTrack follows the pack, not the toggle', () => {
    expect(hasAmbientTrack(settings({ sound: 'rain' }))).toBe(true);
    expect(hasAmbientTrack(settings({ sound: 'silent' }))).toBe(false);
  });

  it('ambientAudible needs both a track and the toggle on', () => {
    expect(
      ambientAudible(state({ ambientOn: true, settings: settings({ sound: 'rain' }) }))
    ).toBe(true);
    expect(
      ambientAudible(state({ ambientOn: false, settings: settings({ sound: 'rain' }) }))
    ).toBe(false);
    expect(
      ambientAudible(state({ ambientOn: true, settings: settings({ sound: 'silent' }) }))
    ).toBe(false);
  });
});
