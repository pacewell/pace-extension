import { AMBIENT_VOLUME, CUE_VOLUME, FADE_OUT_MS } from '../shared/constants';
import type { OffscreenMessage } from '../shared/types';

const ambient = new Audio();
ambient.loop = true;

let baseVolume = AMBIENT_VOLUME;
let fadeHandle: number | null = null;

function cancelFade(): void {
  if (fadeHandle !== null) {
    clearInterval(fadeHandle);
    fadeHandle = null;
  }
}

function playCue(file: string): void {
  const cue = new Audio(chrome.runtime.getURL(file));
  cue.volume = CUE_VOLUME;
  void cue.play().catch(() => undefined);
}

/** Sound the cue immediately and fade the ambient out underneath it, so the
    chime lands the instant the mask appears instead of waiting out the fade. */
function cueAndFadeOut(file: string): void {
  cancelFade();
  playCue(file);
  if (ambient.paused) return;
  const startVolume = ambient.volume;
  const startedAt = Date.now();
  fadeHandle = setInterval(() => {
    const k = Math.min(1, (Date.now() - startedAt) / FADE_OUT_MS);
    ambient.volume = startVolume * (1 - k);
    if (k >= 1) {
      cancelFade();
      ambient.pause();
      ambient.volume = baseVolume;
    }
  }, 50);
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as OffscreenMessage;
  if (!msg || msg.target !== 'offscreen') return;
  switch (msg.type) {
    case 'audio:ambient': {
      cancelFade();
      baseVolume = msg.volume;
      const url = chrome.runtime.getURL(msg.file);
      if (ambient.src !== url) ambient.src = url;
      ambient.volume = baseVolume;
      ambient.muted = msg.muted;
      void ambient.play().catch(() => undefined);
      break;
    }
    case 'audio:cue':
      playCue(msg.file);
      break;
    case 'audio:cueAndFade':
      cueAndFadeOut(msg.file);
      break;
    case 'audio:stop':
      cancelFade();
      ambient.pause();
      ambient.volume = baseVolume;
      break;
    case 'audio:setMuted':
      ambient.muted = msg.muted;
      break;
  }
});
