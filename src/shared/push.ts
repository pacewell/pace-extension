import type { BreakKind, Settings } from './types';

/** A ready-to-send ntfy message (header text is ASCII; tags map to emoji). */
export interface PushMessage {
  title: string;
  body: string;
  tags: string;
}

/* Calm, concrete words — readable in the ntfy subscription list and easy to
   verify by eye. Memorability is a bonus; the random tail carries the entropy. */
const TOPIC_WORDS = [
  'amber',
  'birch',
  'brook',
  'cedar',
  'cloud',
  'cove',
  'dawn',
  'delta',
  'dune',
  'ember',
  'fern',
  'fjord',
  'glade',
  'grove',
  'harbor',
  'heath',
  'lake',
  'lantern',
  'leaf',
  'lily',
  'maple',
  'meadow',
  'mist',
  'moss',
  'opal',
  'pebble',
  'pine',
  'quartz',
  'quiet',
  'reed',
  'ridge',
  'river',
  'shore',
  'slate',
  'sparrow',
  'spruce',
  'still',
  'stone',
  'thistle',
  'tide',
  'vale',
  'willow',
];

/* base32-ish alphabet without look-alikes (no l/o/0/1) for the random tail. */
const TAIL_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function pick<T>(arr: readonly T[]): T {
  const idx = new Uint32Array(1);
  crypto.getRandomValues(idx);
  return arr[idx[0] % arr.length];
}

/** `pace-<word>-<word>-<8 random chars>` — unguessable, no PII, self-identifying
    in the ntfy app. Generated once on first enable and reused across runs. */
export function generateTopic(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const tail = Array.from(
    bytes,
    (b) => TAIL_ALPHABET[b % TAIL_ALPHABET.length]
  ).join('');
  return `pace-${pick(TOPIC_WORDS)}-${pick(TOPIC_WORDS)}-${tail}`;
}

/** Spells out the break length because the phone shows no countdown. */
export function breakPushMessage(kind: BreakKind, s: Settings): PushMessage {
  const mins = kind === 'long' ? s.longBreakMin : s.breakMin;
  const label = kind === 'long' ? 'Long break' : 'Short break';
  return {
    title: 'Time for a break',
    body: `${label} · ${mins} min — step away from the screen and rest.`,
    tags: 'coffee',
  };
}

/** Fired when a break ends, so an away user knows to come back. */
export function breakOverPushMessage(s: {
  currentSession: number;
  totalSessions: number;
}): PushMessage {
  return {
    title: "Break's over",
    body: `Come back when you're ready — pick up at session ${s.currentSession + 1} of ${s.totalSessions}.`,
    tags: 'writing_hand',
  };
}

export function completePushMessage(): PushMessage {
  return {
    title: 'All sessions complete',
    body: 'Nice work — your run is done.',
    tags: 'tada',
  };
}
