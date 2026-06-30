/**
 * Pure popup view-model: the decisions that drive the UI, with no DOM or chrome
 * so they can be unit-tested. The render functions (views.ts) and boot
 * (popup.ts) read these; everything here is a plain function of its inputs.
 */
import {
  DEFAULT_PREFS,
  DEFAULT_PUSH,
  SESSION_MAX,
  SESSION_MIN,
} from '../shared/constants';
import type { Prefs, PushConfig, SessionState } from '../shared/types';

export type ViewId =
  | 'plan'
  | 'working'
  | 'confirm'
  | 'breaking'
  | 'waiting'
  | 'complete'
  | 'settings'
  | 'push-setup';

/** Transient overlays the user opened, which win over the phase-derived view. */
export type Mode = 'auto' | 'settings' | 'confirm' | 'push';

/** Which view to show: an open overlay (settings/confirm/push) wins, otherwise
    the phase decides. */
export function currentView(mode: Mode, state: SessionState): ViewId {
  if (mode === 'push') return 'push-setup';
  if (mode === 'settings') return 'settings';
  if (mode === 'confirm') return 'confirm';
  switch (state.phase) {
    case 'idle':
      return 'plan';
    case 'focus':
      return 'working';
    case 'paused':
      return state.pausedFrom === 'break' ? 'breaking' : 'working';
    case 'break':
      return 'breaking';
    case 'waiting':
      return 'waiting';
    case 'complete':
      return 'complete';
  }
}

/** The "End this run?" confirm is tied to a live run; once a broadcast shows the
    run has left focus/paused (ended or rolled into a break), drop back to auto so
    the dialog doesn't linger over the wrong screen. */
export function nextModeOnBroadcast(mode: Mode, state: SessionState): Mode {
  if (
    mode === 'confirm' &&
    state.phase !== 'focus' &&
    state.phase !== 'paused'
  ) {
    return 'auto';
  }
  return mode;
}

/** Sanitize stored planning prefs: clamp the session count into range and
    type-guard each field, falling back to the defaults. */
export function parsePrefs(raw: unknown): Prefs {
  const prefs: Prefs = { ...DEFAULT_PREFS };
  const stored = raw as Partial<Prefs> | undefined;
  if (stored) {
    if (typeof stored.sessions === 'number') {
      prefs.sessions = Math.min(
        SESSION_MAX,
        Math.max(SESSION_MIN, stored.sessions)
      );
    }
    if (typeof stored.ambientOn === 'boolean') {
      prefs.ambientOn = stored.ambientOn;
    }
  }
  return prefs;
}

/** Sanitize the stored push config, type-guarding each field. */
export function parsePush(raw: unknown): PushConfig {
  const push: PushConfig = { ...DEFAULT_PUSH };
  const stored = raw as Partial<PushConfig> | undefined;
  if (stored) {
    if (typeof stored.enabled === 'boolean') push.enabled = stored.enabled;
    if (typeof stored.topic === 'string') push.topic = stored.topic;
  }
  return push;
}
