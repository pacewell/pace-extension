import componentStyles from '../styles/components.css?inline';
import {
  BREAK_CUES,
  CUE_ROTATE_MS,
  LOGO_GLYPH_PATH,
  MOUSE_ARM_DELAY_MS,
  MOUSE_TRAVEL_PX,
} from '../shared/constants';
import { inBreak, phaseRemainingPct } from '../shared/session';
import type { BroadcastMessage, SessionState } from '../shared/types';

const isTopFrame = window.self === window.top;

let state: SessionState | null = null;

interface MaskRefs {
  host: HTMLDivElement;
  root: HTMLDivElement;
  logo: HTMLDivElement;
  icon: HTMLDivElement;
  cue: HTMLHeadingElement;
  meta: HTMLDivElement;
  bar: HTMLDivElement;
  fill: HTMLDivElement;
  hide: HTMLButtonElement;
}

let mask: MaskRefs | null = null;
let maskMode: 'break' | 'waiting' | null = null;
let tickTimer = 0;
let cueTimer = 0;
let cueIndex = 0;

/* Mouse-wake guards (waiting phase only): ignore movement right after the
   mask appears and require deliberate travel before reacting. */
let armTimer = 0;
let armed = false;
let travel = 0;
let lastX = -1;
let lastY = -1;
let watching = false;

/** True once the extension was reloaded/updated, orphaning this script. */
function contextGone(): boolean {
  // chrome.runtime.id becomes undefined when the context is invalidated.
  return !chrome.runtime?.id;
}

/** Send to the background, surviving an invalidated context (sendMessage
    throws synchronously then, so .catch alone is not enough). */
function safeSend(message: unknown): void {
  if (contextGone()) {
    teardown();
    return;
  }
  try {
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    teardown();
  }
}

/** Detach the orphaned content script: clear the mask, timers, listeners. */
function teardown(): void {
  hideMaskLocal();
  stopMouseWatch();
}

function pauseMedia(): void {
  const media = document.querySelectorAll<HTMLMediaElement>('video, audio');
  media.forEach((el) => {
    if (!el.paused) el.pause();
  });
}

function ensureMask(): MaskRefs {
  if (mask) return mask;
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = componentStyles;
  shadow.appendChild(style);

  const root = document.createElement('div');
  root.className = 'pace-extension-root pace-mask';

  // Quiet brand signature in the top-left corner, outside the content flow.
  const logo = document.createElement('div');
  logo.className = 'pace-mask__logo';
  logo.innerHTML =
    '<svg width="30" height="30" viewBox="0 0 512 512" fill="currentColor">' +
    `<path fill-rule="evenodd" clip-rule="evenodd" d="${LOGO_GLYPH_PATH}"/></svg>`;

  // Mouse glyph for the waiting state: lives in the bottom action zone
  // (same slot as Hide during breaks) and nudges periodically.
  const icon = document.createElement('div');
  icon.className = 'pace-mask__icon';
  icon.innerHTML =
    '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
    '<rect x="7" y="3" width="10" height="18" rx="5"/>' +
    '<line x1="12" y1="7" x2="12" y2="10"/></svg>';

  const cue = document.createElement('h1');
  cue.className = 'pace-mask__cue';

  const meta = document.createElement('div');
  meta.className = 'pace-mask__meta';

  const bar = document.createElement('div');
  bar.className = 'pace-progress pace-progress--dark pace-mask__bar';
  const fill = document.createElement('div');
  fill.className = 'pace-progress__fill';
  bar.appendChild(fill);

  const hide = document.createElement('button');
  hide.className = 'pace-mask__hide';
  hide.textContent = 'Hide';
  hide.addEventListener('click', () => {
    safeSend({ type: 'hideMask' });
  });

  root.append(logo, icon, cue, bar, meta, hide);
  shadow.appendChild(root);
  document.documentElement.appendChild(host);

  mask = { host, root, logo, icon, cue, meta, bar, fill, hide };
  return mask;
}

function rotateCue(): void {
  if (!mask || maskMode !== 'break') return;
  const { cue } = mask;
  cue.style.opacity = '0';
  setTimeout(() => {
    if (!mask || maskMode !== 'break') return;
    cueIndex = (cueIndex + 1) % BREAK_CUES.length;
    mask.cue.textContent = BREAK_CUES[cueIndex].title;
    mask.cue.style.opacity = '1';
  }, 600);
}

function tickProgress(): void {
  if (!mask || !state || maskMode !== 'break') return;
  mask.fill.style.width = `${phaseRemainingPct(state, Date.now())}%`;
}

function showMask(nextMode: 'break' | 'waiting'): void {
  if (!state) return;
  const m = ensureMask();
  const modeChanged = maskMode !== nextMode;
  maskMode = nextMode;

  if (nextMode === 'break') {
    cueIndex = 0;
    m.cue.textContent = BREAK_CUES[cueIndex].title;
    m.meta.textContent = `Session ${state.currentSession} of ${state.totalSessions}`;
    m.root.classList.remove('pace-mask--waiting');
    m.icon.style.display = 'none';
    m.bar.style.display = '';
    m.hide.style.display = '';
    tickProgress();
    clearInterval(tickTimer);
    tickTimer = setInterval(tickProgress, 500);
    clearInterval(cueTimer);
    cueTimer = setInterval(rotateCue, CUE_ROTATE_MS);
  } else {
    m.cue.textContent = 'Break complete.';
    m.cue.style.opacity = '1';
    m.meta.textContent = `Session ${state.currentSession + 1} of ${state.totalSessions}`;
    m.root.classList.add('pace-mask--waiting');
    m.icon.style.display = '';
    m.bar.style.display = 'none';
    m.hide.style.display = 'none';
    clearInterval(tickTimer);
    clearInterval(cueTimer);
  }

  requestAnimationFrame(() => {
    mask?.root.classList.add('pace-mask--visible');
  });

  if (modeChanged) rearmMouseWatch();
}

function hideMaskLocal(): void {
  clearInterval(tickTimer);
  clearInterval(cueTimer);
  if (mask) {
    mask.host.remove();
    mask = null;
  }
  maskMode = null;
}

function rearmMouseWatch(): void {
  armed = false;
  travel = 0;
  lastX = -1;
  lastY = -1;
  clearTimeout(armTimer);
  armTimer = setTimeout(() => {
    armed = true;
  }, MOUSE_ARM_DELAY_MS);
}

function onMouseMove(e: MouseEvent): void {
  if (!armed || !state || state.phase !== 'waiting') return;
  if (lastX >= 0)
    travel += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
  if (travel < MOUSE_TRAVEL_PX) return;

  armed = false;
  safeSend({ type: 'beginNext' });
}

function startMouseWatch(): void {
  if (watching) return;
  watching = true;
  document.addEventListener('mousemove', onMouseMove, true);
  rearmMouseWatch();
}

function stopMouseWatch(): void {
  if (!watching) return;
  watching = false;
  document.removeEventListener('mousemove', onMouseMove, true);
  clearTimeout(armTimer);
  armed = false;
}

function render(): void {
  if (!isTopFrame || !state) return;
  if (inBreak(state)) {
    if (state.maskHidden) hideMaskLocal();
    else showMask('break');
    stopMouseWatch();
  } else if (state.phase === 'waiting') {
    showMask('waiting');
    startMouseWatch();
  } else {
    hideMaskLocal();
    stopMouseWatch();
  }
}

function renderKey(s: SessionState | null): string {
  return s ? `${s.phase}:${s.pausedFrom}:${s.maskHidden}` : '';
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as BroadcastMessage;
  if (msg.type === 'stateChanged') {
    const previousKey = renderKey(state);
    state = msg.state;
    if (renderKey(state) !== previousKey) render();
  } else if (msg.type === 'pauseMedia') {
    pauseMedia();
  }
});

try {
  void chrome.runtime
    .sendMessage({ type: 'getState' })
    .then((response) => {
      state = response as SessionState;
      render();
    })
    .catch(() => undefined);
} catch {
  teardown();
}
