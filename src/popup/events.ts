/**
 * Popup interactions: the one-time DOM construction that carries listeners
 * (interval chips, sound tiles), the global event bindings, and the push-setup
 * action. Everything that attaches a listener or mutates the store lives here;
 * rendering is delegated to views.ts.
 */
import { INTERVAL_CHOICES, PACKS, STORAGE_KEYS } from '../shared/constants';
import { generateTopic } from '../shared/push';
import type { SoundId, ViewMessage } from '../shared/types';
import { $, retrigger } from './dom';
import { savePush, send, store } from './store';
import { render, renderPlan, renderSettings } from './views';

/** Send a command to the background, adopt the returned state, and re-render —
    the round-trip every action button shares. */
function dispatch(msg: ViewMessage): void {
  void (async () => {
    store.state = await send(msg);
    render();
  })();
}

export function buildIntervalChips(): void {
  const wrap = $('interval-chips');
  wrap.textContent = '';
  for (const n of INTERVAL_CHOICES) {
    const b = document.createElement('button');
    b.className = 'pace-chip';
    b.textContent = String(n);
    b.addEventListener('click', () => {
      store.draft.longBreakInterval = n;
      renderSettings();
    });
    wrap.appendChild(b);
  }
}

export function buildSoundTiles(): void {
  const wrap = $('sound-tiles');
  wrap.textContent = '';
  for (const id of Object.keys(PACKS) as SoundId[]) {
    const b = document.createElement('button');
    b.className = 'pace-tile';
    b.dataset.sound = id;
    const name = document.createElement('span');
    name.textContent = PACKS[id].label;
    const check = document.createElement('span');
    check.className = 'pace-tile__check';
    check.textContent = '✓';
    b.append(name, check);
    b.addEventListener('click', () => {
      store.draft.sound = id;
      renderSettings();
    });
    wrap.appendChild(b);
  }
}

/** Open the dedicated setup page. The topic is generated (and persisted, still
    disabled → nothing is sent) on first visit so the QR/link are stable. */
function openPushSetup(from: 'auto' | 'settings'): void {
  store.pushReturn = from;
  if (store.push.topic === '') {
    store.push.topic = generateTopic();
    savePush();
  }
  store.mode = 'push';
  render();
}

export function bindEvents(): void {
  $('btn-settings').addEventListener('click', () => {
    store.draft = { ...store.state.settings };
    renderSettings();
    store.mode = 'settings';
    render();
  });

  $('session-slider').addEventListener('input', (e) => {
    store.prefs.sessions = Number((e.target as HTMLInputElement).value);
    void chrome.storage.local.set({ [STORAGE_KEYS.prefs]: store.prefs });
    renderPlan();
    retrigger($('plan-count'), 'pace-count--settle');
  });

  $('ambient-toggle').addEventListener('change', (e) => {
    store.prefs.ambientOn = (e.target as HTMLInputElement).checked;
    void chrome.storage.local.set({ [STORAGE_KEYS.prefs]: store.prefs });
  });

  $('reminder-toggle').addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    if (!box.checked) {
      store.push.enabled = false;
      savePush();
      return;
    }
    // First enable routes through setup so the user can pair a device; once a
    // topic exists, flipping it on just turns it back on.
    if (store.push.topic !== '') {
      store.push.enabled = true;
      savePush();
    } else {
      box.checked = false;
      openPushSetup('auto');
    }
  });

  $('btn-start').addEventListener('click', () => {
    dispatch({
      type: 'start',
      sessions: store.prefs.sessions,
      ambientOn: store.prefs.ambientOn,
    });
  });

  // Mid-run on/off (topic already paired → a plain flag flip the background
  // reads at the next boundary; carries across continuous sessions).
  $('working-reminder-toggle').addEventListener('change', (e) => {
    store.push.enabled = (e.target as HTMLInputElement).checked;
    savePush();
  });

  $('btn-pause').addEventListener('click', () => {
    dispatch({ type: store.state.phase === 'paused' ? 'resume' : 'pause' });
  });

  $('mute-toggle').addEventListener('change', () => {
    dispatch({ type: 'toggleMute' });
  });

  $('btn-end').addEventListener('click', () => {
    store.mode = 'confirm';
    render();
  });

  $('btn-confirm-cancel').addEventListener('click', () => {
    store.mode = 'auto';
    render();
  });

  $('btn-confirm-end').addEventListener('click', () => {
    store.mode = 'auto';
    dispatch({ type: 'end' });
  });

  $('btn-break-pause').addEventListener('click', () => {
    dispatch({ type: store.state.phase === 'paused' ? 'resume' : 'pause' });
  });

  $('btn-resume-next').addEventListener('click', () => {
    dispatch({ type: 'beginNext' });
  });

  $('btn-complete-done').addEventListener('click', () => {
    dispatch({ type: 'end' });
  });

  /* Settings */
  $('focus-slider').addEventListener('input', (e) => {
    store.draft.focusMin = Number((e.target as HTMLInputElement).value);
    renderSettings();
  });
  $('break-slider').addEventListener('input', (e) => {
    store.draft.breakMin = Number((e.target as HTMLInputElement).value);
    renderSettings();
  });
  $('longbreak-slider').addEventListener('input', (e) => {
    store.draft.longBreakMin = Number((e.target as HTMLInputElement).value);
    renderSettings();
  });
  $('longbreak-toggle').addEventListener('change', (e) => {
    store.draft.longBreakEnabled = (e.target as HTMLInputElement).checked;
    renderSettings();
  });
  $('btn-back').addEventListener('click', () => {
    store.mode = 'auto';
    render();
  });
  $('btn-save').addEventListener('click', () => {
    store.mode = 'auto';
    dispatch({ type: 'saveSettings', settings: store.draft });
  });

  /* Cross-device reminder setup */
  $('open-push-setup').addEventListener('click', () =>
    openPushSetup('settings')
  );

  $('push-back').addEventListener('click', () => {
    store.mode = store.pushReturn;
    render();
  });

  $('push-copy').addEventListener('click', () => {
    void navigator.clipboard.writeText(store.push.topic);
    const btn = $('push-copy');
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = 'Copy'), 1200);
  });

  $('push-enable').addEventListener('click', () => {
    store.push.enabled = true;
    savePush();
    store.mode = store.pushReturn;
    render();
  });
}
