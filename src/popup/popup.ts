/**
 * Popup entry point: wire the background broadcast into a re-render, load
 * persisted prefs/push, build the one-time DOM, and start the cosmetic tick.
 * The work is delegated — store.ts (state), views.ts (render), events.ts
 * (interactions), viewmodel.ts (pure decisions).
 */
import { STORAGE_KEYS } from '../shared/constants';
import type { BroadcastMessage } from '../shared/types';
import { $ } from './dom';
import { bindEvents, buildIntervalChips, buildSoundTiles } from './events';
import { send, store } from './store';
import { render } from './views';
import { nextModeOnBroadcast, parsePrefs, parsePush } from './viewmodel';

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as BroadcastMessage;
  if (msg.type === 'stateChanged') {
    store.state = msg.state;
    store.mode = nextModeOnBroadcast(store.mode, store.state);
    render();
  }
});

async function init(): Promise<void> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.prefs,
    STORAGE_KEYS.push,
  ]);
  store.prefs = parsePrefs(stored[STORAGE_KEYS.prefs]);
  store.push = parsePush(stored[STORAGE_KEYS.push]);
  store.state = await send({ type: 'getState' });
  $('about-version').textContent = `Pace v${chrome.runtime.getManifest().version}`;
  buildIntervalChips();
  buildSoundTiles();
  bindEvents();
  render();
  setInterval(() => {
    if (store.mode === 'auto') render();
  }, 250);
}

void init();
