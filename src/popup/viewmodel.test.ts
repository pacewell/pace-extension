import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, SESSION_MAX, SESSION_MIN } from '../shared/constants';
import { idleState } from '../shared/state';
import type { SessionState, Settings } from '../shared/types';
import {
  currentView,
  nextModeOnBroadcast,
  parsePrefs,
  parsePush,
} from './viewmodel';

const state = (over: Partial<SessionState> = {}): SessionState => ({
  ...idleState({} as Settings),
  ...over,
});

describe('currentView', () => {
  it('an open overlay wins over the phase', () => {
    expect(currentView('push', state({ phase: 'focus' }))).toBe('push-setup');
    expect(currentView('settings', state({ phase: 'break' }))).toBe('settings');
    expect(currentView('confirm', state({ phase: 'focus' }))).toBe('confirm');
  });

  it('maps each phase to its view in auto mode', () => {
    expect(currentView('auto', state({ phase: 'idle' }))).toBe('plan');
    expect(currentView('auto', state({ phase: 'focus' }))).toBe('working');
    expect(currentView('auto', state({ phase: 'break' }))).toBe('breaking');
    expect(currentView('auto', state({ phase: 'waiting' }))).toBe('waiting');
    expect(currentView('auto', state({ phase: 'complete' }))).toBe('complete');
  });

  it('routes a pause by what it interrupted', () => {
    expect(
      currentView('auto', state({ phase: 'paused', pausedFrom: 'focus' }))
    ).toBe('working');
    expect(
      currentView('auto', state({ phase: 'paused', pausedFrom: 'break' }))
    ).toBe('breaking');
  });
});

describe('nextModeOnBroadcast', () => {
  it('keeps the confirm dialog while the run is still focus/paused', () => {
    expect(nextModeOnBroadcast('confirm', state({ phase: 'focus' }))).toBe(
      'confirm'
    );
    expect(nextModeOnBroadcast('confirm', state({ phase: 'paused' }))).toBe(
      'confirm'
    );
  });

  it('drops confirm back to auto once the run leaves focus/paused', () => {
    expect(nextModeOnBroadcast('confirm', state({ phase: 'break' }))).toBe(
      'auto'
    );
    expect(nextModeOnBroadcast('confirm', state({ phase: 'idle' }))).toBe(
      'auto'
    );
  });

  it('leaves other modes untouched', () => {
    expect(nextModeOnBroadcast('settings', state({ phase: 'idle' }))).toBe(
      'settings'
    );
    expect(nextModeOnBroadcast('push', state({ phase: 'break' }))).toBe('push');
  });
});

describe('parsePrefs', () => {
  it('falls back to defaults on missing or junk input', () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ sessions: 'nope', ambientOn: 1 })).toEqual(
      DEFAULT_PREFS
    );
  });

  it('clamps the session count into range', () => {
    expect(parsePrefs({ sessions: 999 }).sessions).toBe(SESSION_MAX);
    expect(parsePrefs({ sessions: 0 }).sessions).toBe(SESSION_MIN);
    expect(parsePrefs({ sessions: SESSION_MIN + 1 }).sessions).toBe(
      SESSION_MIN + 1
    );
  });

  it('keeps a valid ambient flag', () => {
    expect(parsePrefs({ ambientOn: false }).ambientOn).toBe(false);
  });
});

describe('parsePush', () => {
  it('defaults to disabled with no topic', () => {
    expect(parsePush(undefined)).toEqual({ enabled: false, topic: '' });
  });

  it('reads valid fields and ignores wrong types', () => {
    expect(parsePush({ enabled: true, topic: 'pace-abc' })).toEqual({
      enabled: true,
      topic: 'pace-abc',
    });
    expect(parsePush({ enabled: 'yes', topic: 42 })).toEqual({
      enabled: false,
      topic: '',
    });
  });
});
