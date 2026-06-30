import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import type { Settings } from './types';
import {
  completeSummary,
  fmtDuration,
  progressLabel,
  rhythmText,
  sessionUnit,
} from './strings';

const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

describe('sessionUnit', () => {
  it('is singular only for one', () => {
    expect(sessionUnit(1)).toBe('session');
    expect(sessionUnit(0)).toBe('sessions');
    expect(sessionUnit(4)).toBe('sessions');
  });
});

describe('progressLabel', () => {
  it('formats "Session X of Y"', () => {
    expect(progressLabel(3, 4)).toBe('Session 3 of 4');
  });
});

describe('fmtDuration', () => {
  it('plain minutes under an hour', () => {
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDuration(0)).toBe('0 min');
  });

  it('hours with remainder', () => {
    expect(fmtDuration(100)).toBe('1h 40m');
  });

  it('whole hours drop the minutes', () => {
    expect(fmtDuration(60)).toBe('1h');
    expect(fmtDuration(120)).toBe('2h');
  });
});

describe('rhythmText', () => {
  it('focus + short break + the long-break clause when enabled', () => {
    expect(rhythmText(settings())).toBe(
      'Each session is 25 min of focus, then a 5 min break.' +
        ' After every 4 sessions, a longer 15 min break.'
    );
  });

  it('omits the long-break clause when disabled', () => {
    expect(rhythmText(settings({ longBreakEnabled: false }))).toBe(
      'Each session is 25 min of focus, then a 5 min break.'
    );
  });
});

describe('completeSummary', () => {
  it('pluralizes and formats the focus total', () => {
    expect(completeSummary(4, settings())).toBe('4 sessions · 1h 40m of focus');
  });

  it('handles a single session', () => {
    expect(completeSummary(1, settings())).toBe('1 session · 25 min of focus');
  });
});
