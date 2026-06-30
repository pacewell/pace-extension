import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import {
  breakOverPushMessage,
  breakPushMessage,
  completePushMessage,
  generateTopic,
} from './push';

describe('breakPushMessage', () => {
  it('short break: spells out label + minutes', () => {
    const m = breakPushMessage('short', DEFAULT_SETTINGS);
    expect(m.title).toBe('Time for a break');
    expect(m.body).toContain('Short break · 5 min');
    expect(m.tags).toBe('coffee');
  });

  it('long break uses the long duration', () => {
    expect(breakPushMessage('long', DEFAULT_SETTINGS).body).toContain(
      'Long break · 15 min'
    );
  });
});

describe('breakOverPushMessage', () => {
  it('points at the next session (currentSession + 1)', () => {
    const m = breakOverPushMessage({ currentSession: 2, totalSessions: 4 });
    expect(m.title).toBe("Break's over");
    expect(m.body).toContain('session 3 of 4');
  });
});

describe('completePushMessage', () => {
  it('is the static completion message', () => {
    expect(completePushMessage().title).toBe('All sessions complete');
  });
});

describe('generateTopic', () => {
  it('matches pace-<word>-<word>-<8 chars> with the look-alike-free tail', () => {
    // Tail alphabet drops the look-alikes l, o, 0, 1.
    expect(generateTopic()).toMatch(/^pace-[a-z]+-[a-z]+-[a-km-np-z2-9]{8}$/);
  });

  it('is randomized across calls', () => {
    const topics = new Set(Array.from({ length: 25 }, () => generateTopic()));
    expect(topics.size).toBeGreaterThan(1);
  });
});
