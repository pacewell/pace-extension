import type { CueId, Prefs, PushConfig, Settings, SoundId } from './types';

/** A sound pack: a matched ambient loop + its transition-cue family. */
export interface SoundPack {
  label: string;
  /** Seamless ambient loop, or null for no drone (Silent still cues). */
  ambient: string | null;
  cues: Record<CueId, string>;
}

const cueSet = (pack: string): Record<CueId, string> => ({
  break: `audio/${pack}/cue-break.ogg`,
  complete: `audio/${pack}/cue-complete.ogg`,
});

export const PACKS: Record<SoundId, SoundPack> = {
  rain: { label: 'Rain', ambient: 'audio/rain/loop.ogg', cues: cueSet('rain') },
  forest: {
    label: 'Forest',
    ambient: 'audio/forest/loop.ogg',
    cues: cueSet('forest'),
  },
  cafe: { label: 'Café', ambient: 'audio/cafe/loop.ogg', cues: cueSet('cafe') },
  silent: { label: 'Silent', ambient: null, cues: cueSet('silent') },
};

export const AMBIENT_VOLUME = 0.6;
export const CUE_VOLUME = 0.7;
export const FADE_OUT_MS = 3000;

export const SESSION_MIN = 1;
export const SESSION_MAX = 10;
export const INTERVAL_CHOICES = [2, 3, 4, 5, 6, 7, 8];

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  breakMin: 5,
  longBreakEnabled: true,
  longBreakInterval: 4,
  longBreakMin: 15,
  sound: 'rain',
  testMode: false,
};

export const DEFAULT_PREFS: Prefs = { sessions: 4, ambientOn: true };

export const DEFAULT_PUSH: PushConfig = { enabled: false, topic: '' };

export const STORAGE_KEYS = {
  state: 'pace:state',
  settings: 'pace:settings',
  prefs: 'pace:prefs',
  push: 'pace:push',
} as const;

/* ------------------------------------------------------------------ */
/* Cross-device break push (ntfy) — opt-in                            */
/* ------------------------------------------------------------------ */

/** Fixed for Phase 0; a self-host URL is Phase 1+. Reachable under the existing
    `<all_urls>` host grant, so no extra permission is requested — the feature is
    instead gated entirely by the off-by-default `enabled` flag (no network until
    opted in). */
export const NTFY_BASE = 'https://ntfy.sh';
/** Validated to buzz a Fitbit reliably while keeping the phone buzz short. */
export const NTFY_PRIORITY = 'default';

export const BREAK_CUES: { title: string; sub: string }[] = [
  { title: 'Look away.', sub: 'Rest your eyes on something distant.' },
  { title: 'Roll your shoulders.', sub: 'Let them soften and drop.' },
  { title: 'Breathe.', sub: 'In for four, hold, out for four.' },
  {
    title: 'Pause and reset.',
    sub: 'Close your eyes and release the tension.',
  },
];

/** How often the rotating rest cue changes, in ms. */
export const CUE_ROTATE_MS = 7000;

/** The "p" glyph from logo.svg (512×512 viewBox, fill-rule evenodd). */
export const LOGO_GLYPH_PATH =
  'M153.768 250.394C147.507 247.891 139.367 241.632 141.246 225.36C143.124 209.088 154.255 183.223 170.673 164.653C194.465 137.742 250.814 103.946 305.286 111.456C363.513 121.47 374.783 152.762 369.775 190.939C364.766 229.115 337.217 251.646 331.582 256.027C325.947 260.408 303.407 277.931 293.39 279.183C282.746 283.355 258.828 291.074 248.31 288.571L264.589 233.496C271.685 209.297 288.381 161.649 298.398 164.653C312.173 156.517 302.781 140.245 293.39 143.374C267.093 156.517 218.883 215.972 204.482 242.258C188.204 265.414 159.403 316.734 147.507 358.04C134.359 392.461 145.002 413.114 153.768 418.121C162.533 423.128 185.699 418.747 200.1 397.468C214.5 376.189 240.171 321.115 241.423 307.972C252.693 307.763 279.866 305.468 298.398 297.958C321.564 288.571 354.748 267.918 372.279 239.129C389.81 210.34 394.193 169.66 386.053 150.259C376.404 127.259 369.775 115.211 336.591 99.5651C322.087 92.7266 200.1 68.8986 131.228 188.435C112.362 234.772 127.263 251.422 133.465 258.352C134.467 259.471 135.242 260.337 135.611 261.033C141.246 271.673 166.29 266.668 153.768 250.394ZM160.655 379.944C161.907 362.42 204.482 256.027 252.693 208.462C250.607 215.676 248.581 222.743 246.599 229.659C226.571 299.547 210.942 354.08 181.317 389.958C162.996 412.145 159.403 397.468 160.655 379.944Z';

/** Mouse-wake guards: arm delay after the mask appears, and required travel. */
export const MOUSE_ARM_DELAY_MS = 1500;
export const MOUSE_TRAVEL_PX = 80;
