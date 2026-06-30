/**
 * Toolbar icon + badge. The icon is rendered at runtime from the logo glyph
 * (only the focus phase fills it; every other phase is the outline mark with
 * the badge carrying the state colour). The badge minute is driven by a
 * one-shot tick re-armed exactly when the displayed minute drops, rather than a
 * periodic alarm Chrome would throttle and let drift.
 */
import { LOGO_GLYPH_PATH } from '../shared/constants';
import { badgeText, minuteMs } from '../shared/schedule';
import type { SessionState } from '../shared/types';
import { getState } from './io';
import { TICK_ALARM } from './scheduling';

const ESPRESSO = '#3a3632';
const SAGE = '#8a9a86';
const TAUPE = '#a8998a';
const BADGE_GRAY = '#57514b';
const CREAM = '#fdfcf9';

/* Only the focus phase fills the icon (weight = immersion); every other
   phase is the outline mark, with the badge carrying the state colour. */
type IconStyle = 'outline' | 'solid';

const iconCache = new Map<IconStyle, Record<number, ImageData>>();

function drawIcon(size: number, style: IconStyle): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.scale(size / 512, size / 512);
  const glyph = new Path2D(LOGO_GLYPH_PATH);
  if (style === 'outline') {
    ctx.strokeStyle = ESPRESSO;
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.arc(256, 256, 234, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ESPRESSO;
    ctx.fill(glyph);
  } else {
    ctx.fillStyle = ESPRESSO;
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7f5f0';
    ctx.fill(glyph);
  }
  return ctx.getImageData(0, 0, size, size);
}

function iconSet(style: IconStyle): Record<number, ImageData> {
  let set = iconCache.get(style);
  if (!set) {
    set = { 16: drawIcon(16, style), 32: drawIcon(32, style) };
    iconCache.set(style, set);
  }
  return set;
}

/* Keeps the badge minute in step with the popup countdown's leading
   minutes: right after a 25-min focus starts the popup reads 24:59 and
   the badge must read "24m", hence floor with a small epsilon. */
const BADGE_EPSILON_MS = 500;

function badgeMinutes(state: SessionState): string {
  const unit = minuteMs(state.settings);
  return badgeText(state.phaseEndsAt - Date.now() - BADGE_EPSILON_MS, unit);
}

export async function applyPresentation(state: SessionState): Promise<void> {
  let style: IconStyle = 'outline';
  let text = '';
  let bg = BADGE_GRAY;
  switch (state.phase) {
    case 'idle':
      break;
    case 'focus':
      style = 'solid';
      text = badgeMinutes(state);
      bg = BADGE_GRAY;
      break;
    case 'paused':
      text = '||';
      bg = TAUPE;
      break;
    case 'break':
      // Outline icon; the sage badge carries the "recovery" colour.
      text = badgeMinutes(state);
      bg = SAGE;
      break;
    case 'waiting':
      // Forward arrow on sage: "recovered, move to the next session."
      text = '→';
      bg = SAGE;
      break;
    case 'complete':
      // Outline icon; a sage check marks "run finished" until it's dismissed.
      text = '✓';
      bg = SAGE;
      break;
  }
  await chrome.action.setIcon({ imageData: iconSet(style) });
  await chrome.action.setBadgeText({ text });
  if (text) {
    await chrome.action.setBadgeBackgroundColor({ color: bg });
    await chrome.action.setBadgeTextColor({ color: CREAM });
  }
}

let badgeTimer: ReturnType<typeof setTimeout> | undefined;

export function clearBadgeTimer(): void {
  clearTimeout(badgeTimer);
  badgeTimer = undefined;
}

export async function scheduleBadgeTick(state: SessionState): Promise<void> {
  clearBadgeTimer();
  await chrome.alarms.clear(TICK_ALARM);
  if (state.phase !== 'focus' && state.phase !== 'break') return;
  const unit = minuteMs(state.settings);
  const displayed = Math.floor(
    (state.phaseEndsAt - Date.now() - BADGE_EPSILON_MS) / unit
  );
  if (displayed <= 0) return;
  // Fires just after the moment `displayed` decreases by one.
  const at = state.phaseEndsAt - displayed * unit - BADGE_EPSILON_MS / 2;
  if (__ENABLE_TEST_MODE__ && state.settings.testMode) {
    badgeTimer = setTimeout(
      () => void onBadgeTick(),
      Math.max(0, at - Date.now())
    );
  } else {
    await chrome.alarms.create(TICK_ALARM, { when: at });
  }
}

export async function onBadgeTick(): Promise<void> {
  const state = await getState();
  await applyPresentation(state);
  await scheduleBadgeTick(state);
}
