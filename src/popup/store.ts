/**
 * Shared mutable popup state. ES-module imports are read-only bindings, so the
 * split modules can't share top-level `let`s; instead they all read and write
 * the fields of this single `store` object (the reference is constant, its
 * fields mutate, so updates are visible everywhere).
 */
import {
  DEFAULT_PREFS,
  DEFAULT_PUSH,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from '../shared/constants';
import { idleState } from '../shared/state';
import type {
  Prefs,
  PushConfig,
  SessionState,
  Settings,
  ViewMessage,
} from '../shared/types';
import type { Mode } from './viewmodel';

interface Store {
  /** Last state from the background; a safe idle placeholder until init loads it. */
  state: SessionState;
  mode: Mode;
  prefs: Prefs;
  /** Working copy of settings while the settings view is open. */
  draft: Settings;
  /* Opt-in cross-device push, managed directly (like prefs) — enabling needs an
     immediate async permission prompt, so it stays outside the draft/Save flow. */
  push: PushConfig;
  /** Where the push setup page returns to (opened from planning vs settings). */
  pushReturn: 'auto' | 'settings';
}

export const store: Store = {
  state: idleState(DEFAULT_SETTINGS),
  mode: 'auto',
  prefs: { ...DEFAULT_PREFS },
  draft: { ...DEFAULT_SETTINGS },
  push: { ...DEFAULT_PUSH },
  pushReturn: 'auto',
};

export function send(msg: ViewMessage): Promise<SessionState> {
  return chrome.runtime.sendMessage<ViewMessage, SessionState>(msg);
}

export function savePush(): void {
  void chrome.storage.local.set({
    [STORAGE_KEYS.push]: {
      enabled: store.push.enabled,
      topic: store.push.topic,
    },
  });
}
