/**
 * Popup rendering. Invariant: every function here only *reads* the store and
 * *writes* the DOM — it never attaches listeners or mutates the store (that's
 * events.ts). Keeping renders side-effect-free is what lets events.ts depend on
 * this module without a cycle.
 */
import {
  BREAK_CUES,
  CUE_ROTATE_MS,
  INTERVAL_CHOICES,
  NTFY_BASE,
  PACKS,
} from '../shared/constants';
import {
  fmtCountdown,
  fmtFinishAt,
  planTotalMs,
  remainingRunMs,
} from '../shared/schedule';
import {
  ambientAudible,
  hasAmbientTrack,
  phaseRemainingMs,
  phaseRemainingPct,
} from '../shared/session';
import {
  completeSummary,
  progressLabel,
  rhythmText,
  sessionUnit,
} from '../shared/strings';
import { $, retrigger } from './dom';
import { qrSvg } from './qr';
import { store } from './store';
import { currentView, type ViewId } from './viewmodel';

const VIEW_IDS: ViewId[] = [
  'plan',
  'working',
  'confirm',
  'breaking',
  'waiting',
  'complete',
  'settings',
  'push-setup',
];

export function render(): void {
  const view = currentView(store.mode, store.state);
  for (const id of VIEW_IDS) {
    $(`view-${id}`).hidden = id !== view;
  }
  if (view === 'plan') renderPlan();
  else if (view === 'working') renderWorking();
  else if (view === 'breaking') renderBreaking();
  else if (view === 'waiting') renderWaiting();
  else if (view === 'complete') renderComplete();
  else if (view === 'push-setup') renderPushSetup();
}

/* ------------------------------------------------------------------ */
/* Planning view                                                       */
/* ------------------------------------------------------------------ */

export function renderPlan(): void {
  const { prefs, state, push } = store;
  $<HTMLInputElement>('session-slider').value = String(prefs.sessions);
  $('plan-count').textContent = String(prefs.sessions);
  $('plan-unit').textContent = sessionUnit(prefs.sessions);
  // The cadence is one-time education, so it lives in a hover tooltip on
  // "sessions" rather than permanently on the home screen.
  $('plan-rhythm').textContent = rhythmText(state.settings);
  // With "Silent" configured there is no on/off decision to make, so the
  // whole row disappears; the working view still names the silent state.
  // The track name alone is enough — the switch carries the on/off meaning.
  $('ambient-row').hidden = !hasAmbientTrack(state.settings);
  $('ambient-label').textContent = PACKS[state.settings.sound].label;
  $<HTMLInputElement>('ambient-toggle').checked = prefs.ambientOn;
  $<HTMLInputElement>('reminder-toggle').checked = push.enabled;
  $('plan-estimate').textContent =
    `Estimated finish: ${fmtFinishAt(Date.now(), planTotalMs(prefs.sessions, state.settings))}`;
}

/* ------------------------------------------------------------------ */
/* Working view                                                        */
/* ------------------------------------------------------------------ */

function renderWorking(): void {
  const { state, push } = store;
  const now = Date.now();
  const remaining = phaseRemainingMs(state, now);
  $('working-progress').textContent = progressLabel(
    state.currentSession,
    state.totalSessions
  );
  $('working-timer').textContent = fmtCountdown(remaining);
  $('working-timer').classList.toggle(
    'pace-timer--paused',
    state.phase === 'paused'
  );
  $('working-fill').style.width = `${phaseRemainingPct(state, now)}%`;

  // With no audible track there is nothing to name or mute, so the whole
  // row collapses rather than leaving a lone left-aligned label.
  const audible = ambientAudible(state);
  $('working-sound-row').hidden = !audible;
  if (audible) {
    $('working-sound').textContent = PACKS[state.settings.sound].label;
    // Switch reads as "sound on" → checked is the un-muted state.
    $<HTMLInputElement>('mute-toggle').checked = !state.muted;
  }

  // Only offer the mid-run toggle once a topic is paired — otherwise enabling
  // would need the setup page, which we don't want to detour into mid-focus.
  const pushable = push.topic !== '';
  $('working-reminder-row').hidden = !pushable;
  if (pushable) {
    $<HTMLInputElement>('working-reminder-toggle').checked = push.enabled;
  }

  $('working-estimate').textContent =
    `Estimated finish: ${fmtFinishAt(now, remainingRunMs(state, now))}`;
  $('btn-pause').textContent = state.phase === 'paused' ? 'Resume' : 'Pause';
}

/* ------------------------------------------------------------------ */
/* Breaking view                                                       */
/* ------------------------------------------------------------------ */

let lastBreakCue = -1;

function renderBreaking(): void {
  const { state } = store;
  const now = Date.now();
  const paused = state.phase === 'paused';
  $('breaking-progress').textContent = progressLabel(
    state.currentSession,
    state.totalSessions
  );
  $('breaking-timer').textContent = fmtCountdown(phaseRemainingMs(state, now));
  $('breaking-timer').classList.toggle('pace-timer--paused', paused);
  $('btn-break-pause').textContent = paused ? 'Resume' : 'Pause';
  $('breaking-fill').style.width = `${phaseRemainingPct(state, now)}%`;

  if (paused) {
    lastBreakCue = -1;
    $('breaking-cue').textContent = 'Paused';
    $('breaking-cue-sub').textContent = 'Resume whenever you’re ready.';
  } else {
    // Rotate the rest cues in sync with the in-page mask.
    const idx = Math.floor(now / CUE_ROTATE_MS) % BREAK_CUES.length;
    if (idx !== lastBreakCue) {
      lastBreakCue = idx;
      $('breaking-cue').textContent = BREAK_CUES[idx].title;
      $('breaking-cue-sub').textContent = BREAK_CUES[idx].sub;
      retrigger($('breaking-cue'), 'pace-fade-in');
      retrigger($('breaking-cue-sub'), 'pace-fade-in');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Waiting / complete views                                            */
/* ------------------------------------------------------------------ */

function renderWaiting(): void {
  // The trailing arrow icon (in the markup) marks the upcoming session.
  $('waiting-progress').textContent = progressLabel(
    store.state.currentSession + 1,
    store.state.totalSessions
  );
}

function renderComplete(): void {
  $('complete-summary').textContent = completeSummary(
    store.state.totalSessions,
    store.state.settings
  );
}

/* ------------------------------------------------------------------ */
/* Settings view                                                       */
/* ------------------------------------------------------------------ */

export function renderSettings(): void {
  const { draft } = store;
  $<HTMLInputElement>('focus-slider').value = String(draft.focusMin);
  $('focus-value').textContent = `${draft.focusMin} min`;
  $<HTMLInputElement>('break-slider').value = String(draft.breakMin);
  $('break-value').textContent = `${draft.breakMin} min`;
  $<HTMLInputElement>('longbreak-toggle').checked = draft.longBreakEnabled;
  $<HTMLInputElement>('longbreak-slider').value = String(draft.longBreakMin);
  $('longbreak-value').textContent = `${draft.longBreakMin} min`;
  $('longbreak-group').classList.toggle(
    'pace-group--disabled',
    !draft.longBreakEnabled
  );

  const chips = $('interval-chips').children;
  for (let i = 0; i < chips.length; i++) {
    chips[i].classList.toggle(
      'pace-chip--selected',
      INTERVAL_CHOICES[i] === draft.longBreakInterval
    );
  }
  const tiles = $('sound-tiles').children;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i] as HTMLElement;
    tile.classList.toggle(
      'pace-tile--selected',
      tile.dataset.sound === draft.sound
    );
  }
}

/* ------------------------------------------------------------------ */
/* Cross-device reminder setup                                         */
/* ------------------------------------------------------------------ */

function renderPushSetup(): void {
  const { push } = store;
  $('push-qr').innerHTML = qrSvg(push.topic);
  $('push-topic').textContent = push.topic;
  const link = $<HTMLAnchorElement>('push-link');
  link.href = `${NTFY_BASE}/${push.topic}`;
  link.textContent = `ntfy.sh/${push.topic}`;
  $('push-enable').textContent = push.enabled ? 'Done' : 'Enable reminders';
}
