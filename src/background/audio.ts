/**
 * Offscreen audio: an MV3 service worker can't play sound, so the background
 * delegates to an offscreen document. This module owns its lifecycle (create on
 * demand, close when idle) and resolves pack/cue ids to file paths so the
 * offscreen doc stays a dumb player.
 */
import { AMBIENT_VOLUME, PACKS } from '../shared/constants';
import type { CueId, OffscreenMessage, SessionState } from '../shared/types';

/* ambientAudible lives in shared/session.ts (it's a pure SessionState fact
   reused by the popup too); audio.ts only plays. */

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length > 0) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Plays ambient focus audio and soft transition chimes.',
    })
    .catch(() => undefined)
    .finally(() => {
      creatingOffscreen = null;
    }) as Promise<void>;
  await creatingOffscreen;
}

export async function audio(msg: OffscreenMessage): Promise<void> {
  await ensureOffscreen();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await chrome.runtime.sendMessage(msg);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

export function closeOffscreenSoon(delayMs = 6000): void {
  setTimeout(() => {
    chrome.offscreen.closeDocument().catch(() => undefined);
  }, delayMs);
}

export async function playAmbient(state: SessionState): Promise<void> {
  const file = PACKS[state.settings.sound].ambient;
  if (!state.ambientOn || !file) return;
  await audio({
    type: 'audio:ambient',
    target: 'offscreen',
    file,
    volume: AMBIENT_VOLUME,
    muted: state.muted,
  });
}

/** Play a transition cue from the active pack's matched family. */
export async function playCue(state: SessionState, cue: CueId): Promise<void> {
  await audio({
    type: 'audio:cue',
    target: 'offscreen',
    file: PACKS[state.settings.sound].cues[cue],
  });
}
