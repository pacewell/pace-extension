import { PACKS, STORAGE_KEYS } from '../shared/constants';
import { ambientAudible, inBreak } from '../shared/session';
import { idleState } from '../shared/state';
import { audio, closeOffscreenSoon, playAmbient, playCue } from './audio';
import { broadcast, getSettings, getState, persist, sendToTabs } from './io';
import {
  afterBreak,
  afterFocus,
  breakState,
  completeState,
  focusState,
  nextFocusState,
  pausedState,
  phaseIsDue,
  resumedState,
  waitingState,
} from './machine';
import { pushBreak, pushBreakOver, pushComplete } from './notify';
import {
  applyPresentation,
  clearBadgeTimer,
  onBadgeTick,
  scheduleBadgeTick,
} from './presentation';
import {
  PHASE_ALARM,
  TICK_ALARM,
  clearPhaseTimer,
  schedulePhaseEnd,
} from './scheduling';
import type {
  AnyMessage,
  SessionState,
  Settings,
  ViewMessage,
} from '../shared/types';

/* ------------------------------------------------------------------ */
/* Commit                                                              */
/* ------------------------------------------------------------------ */

/* The single write path: persist the canonical state, then fan out its side
   effects — toolbar/badge, the re-armed badge tick, and the broadcast to the
   popup and every tab's content script. */
async function setState(state: SessionState): Promise<SessionState> {
  await persist(state);
  await applyPresentation(state);
  await scheduleBadgeTick(state);
  await broadcast({ type: 'stateChanged', state });
  return state;
}

/* ------------------------------------------------------------------ */
/* Phase advance                                                       */
/* ------------------------------------------------------------------ */

/* In test mode the durable alarm and the setTimeout fast path can fire at ~the
   same instant (in unpacked dev the alarm isn't clamped to 30s), and each would
   read the same not-yet-advanced phase — a TOCTOU race that ran the transition,
   and thus its cue *and* cross-device push, twice. This in-memory lock makes the
   advance single: `advancing` is set synchronously before any await, so a second
   trigger arriving while the first is mid-flight bails out. */
let advancing = false;

async function advanceIfDue(expectedEnd?: number): Promise<void> {
  if (advancing) return;
  advancing = true;
  try {
    const state = await getState();
    // The setTimeout path passes the phase end it was armed for, so a timer left
    // over from an already-advanced phase is ignored.
    if (expectedEnd !== undefined && state.phaseEndsAt !== expectedEnd) return;
    if (phaseIsDue(state, Date.now())) await advancePhase(state);
  } finally {
    advancing = false;
  }
}

/* The scheduling module's setTimeout fast path calls this back when a phase
   timer elapses; the durable alarm path routes through onAlarm below. */
const onPhaseDue = (expectedEnd: number): void => void advanceIfDue(expectedEnd);

/* ------------------------------------------------------------------ */
/* State machine                                                       */
/* ------------------------------------------------------------------ */

async function startRun(
  sessions: number,
  ambientOn: boolean
): Promise<SessionState> {
  const settings = await getSettings();
  const state = focusState(settings, sessions, ambientOn, Date.now());
  await schedulePhaseEnd(state, onPhaseDue);
  // No cue on the initial Start: the user just clicked it and is watching the
  // screen. The focus cue only marks *resuming* into a later session.
  await playAmbient(state);
  return setState(state);
}

async function enterBreak(state: SessionState): Promise<SessionState> {
  const next = breakState(state, Date.now());
  await schedulePhaseEnd(next, onPhaseDue);
  await sendToTabs({ type: 'pauseMedia' });
  if (ambientAudible(next)) {
    await audio({
      type: 'audio:cueAndFade',
      target: 'offscreen',
      file: PACKS[next.settings.sound].cues.break,
    });
  } else {
    await playCue(next, 'break');
  }
  // Opt-in cross-device buzz, fired in real time alongside the local cue.
  void pushBreak(next.breakKind, next.settings);
  return setState(next);
}

async function enterWaiting(state: SessionState): Promise<SessionState> {
  const next = waitingState(state);
  await chrome.alarms.clear(PHASE_ALARM);
  clearPhaseTimer();
  return setState(next);
}

async function beginNextFocus(state: SessionState): Promise<SessionState> {
  const next = nextFocusState(state, Date.now());
  await schedulePhaseEnd(next, onPhaseDue);
  // No focus cue: entering a session is always a deliberate, on-screen action
  // (Start / Keep going), or a hidden-mask auto-resume where the ambient fading
  // back in is itself the signal.
  await playAmbient(next);
  return setState(next);
}

async function finishRun(state: SessionState): Promise<SessionState> {
  await chrome.alarms.clear(PHASE_ALARM);
  await chrome.alarms.clear(TICK_ALARM);
  clearPhaseTimer();
  if (ambientAudible(state)) {
    await audio({
      type: 'audio:cueAndFade',
      target: 'offscreen',
      file: PACKS[state.settings.sound].cues.complete,
    });
  } else {
    await playCue(state, 'complete');
  }
  // Opt-in cross-device buzz: the run finished even though you stepped away.
  void pushComplete();
  closeOffscreenSoon();
  // A terminal "complete" screen (congrats + summary) instead of snapping back
  // to idle. It keeps the run's totals for the popup and persists until the user
  // dismisses it (so a finish that happened while the popup was closed is still
  // seen on next open). The Done button routes through `end` → idle.
  return setState(completeState(state));
}

async function pauseRun(state: SessionState): Promise<SessionState> {
  if (state.phase !== 'focus' && state.phase !== 'break') return state;
  const next = pausedState(state, Date.now());
  await chrome.alarms.clear(PHASE_ALARM);
  clearPhaseTimer();
  await audio({ type: 'audio:stop', target: 'offscreen' });
  return setState(next);
}

async function resumeRun(state: SessionState): Promise<SessionState> {
  if (state.phase !== 'paused') return state;
  const next = resumedState(state, Date.now());
  await schedulePhaseEnd(next, onPhaseDue);
  if (next.phase === 'focus') await playAmbient(next);
  return setState(next);
}

async function hideMask(state: SessionState): Promise<SessionState> {
  if (!inBreak(state) || state.maskHidden) return state;
  return setState({ ...state, maskHidden: true });
}

async function endRun(state: SessionState): Promise<SessionState> {
  await chrome.alarms.clear(PHASE_ALARM);
  await chrome.alarms.clear(TICK_ALARM);
  clearPhaseTimer();
  await audio({ type: 'audio:stop', target: 'offscreen' });
  closeOffscreenSoon(500);
  return setState(idleState(state.settings));
}

async function toggleMute(state: SessionState): Promise<SessionState> {
  const next: SessionState = { ...state, muted: !state.muted };
  await audio({
    type: 'audio:setMuted',
    target: 'offscreen',
    muted: next.muted,
  });
  return setState(next);
}

async function saveSettings(
  state: SessionState,
  settings: Settings
): Promise<SessionState> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  // New rules only apply from the next run; a live run keeps its snapshot.
  if (state.phase !== 'idle') return state;
  return setState({ ...state, settings });
}

async function advancePhase(state: SessionState): Promise<SessionState> {
  if (state.phase === 'focus') {
    return afterFocus(state) === 'complete'
      ? finishRun(state)
      : enterBreak(state);
  }
  if (state.phase === 'break') {
    // The break elapsed on the timer (not a user "keep going", which routes
    // through the beginNext message): buzz an away user to come back. Fires once
    // for both the waiting handshake and the hidden-mask auto-resume.
    void pushBreakOver(state);
    // A hidden mask means the user is already at the desk working, so the
    // wake-up handshake is pointless: flow straight into the next session.
    return afterBreak(state) === 'focus'
      ? beginNextFocus(state)
      : enterWaiting(state);
  }
  return state;
}

/* True from a browser restart / install-update until the in-progress run has
   been reset. Chrome persists alarms across a restart and *replays* a past-due
   PHASE_ALARM at boot; without this guard that replay would `advancePhase` —
   chiming a break/complete cue — on a run we're about to reset to idle. */
let restarting = false;

/* A browser restart (or extension install/update) means the user stepped
   away — a focus session is a present activity, so we don't silently let
   the clock run on while the browser was closed. Any in-progress run is
   reset to the planning screen. A plain service-worker revival during a
   live run does NOT come through here (it wakes via alarm/message), so an
   active run keeps ticking from its persisted phaseEndsAt. */
async function resetOnRestart(): Promise<void> {
  try {
    const state = await getState();
    await chrome.alarms.clear(PHASE_ALARM);
    await chrome.alarms.clear(TICK_ALARM);
    clearPhaseTimer();
    clearBadgeTimer();
    if (state.phase === 'idle') {
      await applyPresentation(state);
      return;
    }
    await setState(idleState(state.settings));
  } finally {
    restarting = false;
  }
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    if (alarm.name === TICK_ALARM) {
      await onBadgeTick();
      return;
    }
    if (alarm.name !== PHASE_ALARM) return;
    // Yield once (a storage round-trip) before reading `restarting`: if Chrome
    // dispatched this boot alarm before onStartup, the await gives onStartup time
    // to set the flag, so a past-due phase is reset rather than advanced. The
    // actual advance runs under advanceIfDue's dedupe lock.
    await getState();
    if (restarting) return;
    await advanceIfDue();
  })();
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (state: SessionState) => void) => {
    const msg = message as AnyMessage;
    if ('target' in msg && msg.target === 'offscreen') return false;
    const view = msg as ViewMessage;
    void (async () => {
      const state = await getState();
      switch (view.type) {
        case 'getState':
          sendResponse(state);
          return;
        case 'start':
          sendResponse(await startRun(view.sessions, view.ambientOn));
          return;
        case 'pause':
          sendResponse(await pauseRun(state));
          return;
        case 'resume':
          sendResponse(await resumeRun(state));
          return;
        case 'end':
          sendResponse(await endRun(state));
          return;
        case 'hideMask':
          sendResponse(await hideMask(state));
          return;
        case 'beginNext':
          sendResponse(
            state.phase === 'waiting' ? await beginNextFocus(state) : state
          );
          return;
        case 'toggleMute':
          sendResponse(await toggleMute(state));
          return;
        case 'saveSettings':
          sendResponse(await saveSettings(state, view.settings));
          return;
        default:
          sendResponse(state);
      }
    })();
    return true;
  }
);

chrome.runtime.onInstalled.addListener(() => {
  restarting = true;
  void resetOnRestart();
});

chrome.runtime.onStartup.addListener(() => {
  restarting = true;
  void resetOnRestart();
});
