import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { idleState } from './state';

describe('idleState', () => {
  it('is a blank, idle run carrying the given settings snapshot', () => {
    const s = idleState(DEFAULT_SETTINGS);
    expect(s.phase).toBe('idle');
    expect(s.totalSessions).toBe(0);
    expect(s.currentSession).toBe(0);
    expect(s.phaseEndsAt).toBe(0);
    expect(s.phaseDurationMs).toBe(0);
    expect(s.pausedRemainingMs).toBe(0);
    expect(s.maskHidden).toBe(false);
    expect(s.muted).toBe(false);
    expect(s.settings).toBe(DEFAULT_SETTINGS);
  });

  it('defaults ambient on (the planning screen pre-checks it)', () => {
    expect(idleState(DEFAULT_SETTINGS).ambientOn).toBe(true);
  });
});
