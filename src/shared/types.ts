export type SoundId = 'rain' | 'forest' | 'cafe' | 'silent';

/** Transition cues: only entering a break and finishing the whole run. */
export type CueId = 'break' | 'complete';

export interface Settings {
  focusMin: number;
  breakMin: number;
  longBreakEnabled: boolean;
  longBreakInterval: number;
  longBreakMin: number;
  sound: SoundId;
  /** Developer aid: compresses every product "minute" to one second. */
  testMode: boolean;
}

/** Planning-screen preferences remembered between runs. */
export interface Prefs {
  sessions: number;
  ambientOn: boolean;
}

/** Opt-in cross-device break push (ntfy). Stored apart from the broadcast
    Settings because the topic is a shared secret that must not ride along on
    every `stateChanged` to content scripts. */
export interface PushConfig {
  enabled: boolean;
  /** Unguessable ntfy topic (no PII); generated on first enable, reused across
      runs, kept on disable. Empty string means "not yet configured". */
  topic: string;
}

export type Phase =
  | 'idle'
  | 'focus'
  | 'paused'
  | 'break'
  | 'waiting'
  | 'complete';
export type BreakKind = 'short' | 'long';

export interface SessionState {
  phase: Phase;
  totalSessions: number;
  /** 1-based. During focus: the running session. During break/waiting: the session just completed. */
  currentSession: number;
  breakKind: BreakKind;
  /** Epoch ms when the current phase ends; 0 when not applicable. */
  phaseEndsAt: number;
  phaseDurationMs: number;
  pausedRemainingMs: number;
  /** Which phase the pause interrupted; both focus and break are pausable. */
  pausedFrom: 'focus' | 'break';
  /** Break mask dismissed globally via Hide; irreversible until the break ends.
      When true, the break flows straight into the next focus (no waiting). */
  maskHidden: boolean;
  ambientOn: boolean;
  muted: boolean;
  /** Settings snapshot driving this run (kept in sync when settings are saved). */
  settings: Settings;
}

/** Popup / content script → background. */
export type ViewMessage =
  | { type: 'getState' }
  | { type: 'start'; sessions: number; ambientOn: boolean }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end' }
  | { type: 'hideMask' }
  | { type: 'beginNext' }
  | { type: 'toggleMute' }
  | { type: 'saveSettings'; settings: Settings };

/** Background → popup and content scripts. */
export type BroadcastMessage =
  | { type: 'stateChanged'; state: SessionState }
  | { type: 'pauseMedia' };

/** Background → offscreen audio document. Background resolves pack/cue → file
    paths; the offscreen doc stays a dumb player. */
export type OffscreenMessage =
  | {
      type: 'audio:ambient';
      target: 'offscreen';
      file: string;
      volume: number;
      muted: boolean;
    }
  | { type: 'audio:cue'; target: 'offscreen'; file: string }
  | { type: 'audio:cueAndFade'; target: 'offscreen'; file: string }
  | { type: 'audio:stop'; target: 'offscreen' }
  | { type: 'audio:setMuted'; target: 'offscreen'; muted: boolean };

export type AnyMessage = ViewMessage | BroadcastMessage | OffscreenMessage;
