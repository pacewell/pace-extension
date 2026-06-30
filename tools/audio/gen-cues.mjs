// Generates each sound pack's matched transition-cue family by additive synthesis.
//
// These are ORIGINAL, procedurally synthesized tones — no samples, no third-party
// audio → license-clean (no attribution, freely redistributable), satisfying the
// project's asset-clearance gate. This script IS the provenance: re-run
// to reproduce the .ogg files bit-for-bit.
//
//   node tools/audio/gen-cues.mjs        # writes WAV masters → asset/, Opus → public/ (needs ffmpeg)
//
// "配套": each pack gets its OWN register, timbre, and melodic motif so the cues
// are easy to tell apart and each fits its ambient. Forest is the warmth/consonance
// reference; the rest stay distinct but in that same gentle world — rain = clean
// (softened) glass A4 falling fifth, forest = warm low woody G3 major-pentatonic
// rise, café = mellow mid F4 warm major voicing, silent = soft low-mid D4 bare
// octave (fuller, never harsh — it's the only signal when there's no ambient).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---- timbres: [harmonic ratio, amplitude, decay×dur, inharmonicity cents] ----
// Spread wide so packs sound like different instruments: bright/metallic glass,
// dark/knocky wood, warm/round mellow, near-pure soft.
const VOICES = {
  // Rain's voice: deliberately NOT glassy — mostly fundamental with a faint
  // shimmer and a long soft tail, so it hushes like rain instead of ringing.
  rounded: [
    [1, 1, 1.2, 0],
    [2, 0.28, 0.5, 0],
    [3, 0.08, 0.32, 2],
  ],
  wood: [
    [1, 1, 0.85, 0],
    [2, 0.28, 0.45, 0],
    [2.76, 0.22, 0.32, 8],
    [3.9, 0.08, 0.2, 11],
  ],
  mellow: [
    [1, 1, 1.05, 0],
    [2, 0.32, 0.6, 0],
    [2.99, 0.14, 0.4, 2],
    [4, 0.05, 0.25, 3],
  ],
  // Fuller than before so "silent" reads as an intentional soft tone, not a thin
  // whistle: a touch more 2nd-partial body, longer fundamental.
  soft: [
    [1, 1, 1.3, 0],
    [2, 0.3, 0.6, 0],
    [3, 0.07, 0.35, 1],
  ],
};

// ---- per pack: root note (Hz), timbre, reverb wet, and its OWN motifs ---------
// Motif note = [semitoneFromRoot, onsetSec, noteDur, gain]. Distinct register +
// timbre + interval shape per pack is what makes them tell-apart-able.
const PACKS = {
  // Rain — soft and warm. Dropped to E4 with a rounded (non-glassy) voice and a
  // wetter tail so the cue hushes like rain rather than chiming brightly.
  rain: {
    root: 329.63, // E4
    voice: 'rounded',
    reverb: 0.26,
    cues: {
      break: [[7, 0, 1.3, 0.85], [0, 0.16, 1.7, 1.0]],
      complete: [[0, 0, 1.5, 0.9], [4, 0.12, 1.5, 0.9], [7, 0.24, 1.6, 0.95], [12, 0.4, 1.4, 0.7]],
    },
  },
  // Forest — warm low wood, gentle major-pentatonic gestures (no semitones).
  forest: {
    root: 196.0, // G3
    voice: 'wood',
    reverb: 0.16,
    cues: {
      break: [[9, 0, 1.2, 0.9], [2, 0.18, 1.6, 1.0]],
      complete: [[0, 0, 1.4, 0.9], [4, 0.14, 1.4, 0.9], [9, 0.28, 1.5, 0.95], [16, 0.44, 1.3, 0.7]],
    },
  },
  // Café — mellow mid F. Dropped the tense maj7/9 for a warm major voicing: a
  // soft major-third → root "ding-dong", then an open root-fifth-sixth-octave lift.
  cafe: {
    root: 349.23, // F4
    voice: 'mellow',
    reverb: 0.18,
    cues: {
      break: [[4, 0, 1.2, 0.82], [0, 0.18, 1.7, 1.0]],
      complete: [[0, 0, 1.5, 0.9], [7, 0.14, 1.5, 0.9], [9, 0.28, 1.6, 0.9], [12, 0.44, 1.5, 0.7]],
    },
  },
  // Silent — soft and low-mid (dropped from A5 to D4) so it has body instead of a
  // thin whistle; a gentle fifth → root, then a bare root-fifth-octave. Still the
  // most understated of the four, but clearly present (it's the only no-ambient cue).
  silent: {
    root: 293.66, // D4
    voice: 'soft',
    reverb: 0.14,
    cues: {
      break: [[7, 0, 1.1, 0.72], [0, 0.16, 1.5, 0.8]],
      complete: [[0, 0, 1.4, 0.72], [7, 0.18, 1.4, 0.74], [12, 0.36, 1.5, 0.8]],
    },
  },
};

// ---- per-cue render levels: complete peaks a touch hotter & wetter -----------
const SHAPE = {
  break: { peak: 0.82, dRev: 0.02 },
  complete: { peak: 0.92, dRev: 0.04 },
};

const semis = (root, n) => root * Math.pow(2, n / 12);

function bell(freq, dur, voice) {
  const len = Math.floor(dur * SR);
  const out = new Float32Array(len);
  const attack = Math.floor(0.006 * SR);
  for (const [ratio, amp, decay, cents] of VOICES[voice]) {
    const f = freq * ratio * Math.pow(2, cents / 1200);
    const w = 2 * Math.PI * f;
    const tau = dur * decay;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      let env = Math.exp(-t / tau);
      if (i < attack) env *= i / attack;
      out[i] += amp * env * Math.sin(w * t);
    }
  }
  return out;
}

// ---- light Schroeder reverb (4 combs + 2 allpass) ----------------------------
function comb(x, ms, fb) {
  const d = Math.floor((ms / 1000) * SR);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] + fb * (i - d >= 0 ? out[i - d] : 0);
  return out;
}
function allpass(x, ms, g) {
  const d = Math.floor((ms / 1000) * SR);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xd = i - d >= 0 ? x[i - d] : 0;
    const yd = i - d >= 0 ? out[i - d] : 0;
    out[i] = -g * x[i] + xd + g * yd;
  }
  return out;
}
function reverb(x, wet) {
  const combs = [[29.7, 0.78], [37.1, 0.74], [41.1, 0.71], [43.7, 0.68]];
  let w = new Float32Array(x.length);
  for (const [ms, fb] of combs) {
    const c = comb(x, ms, fb);
    for (let i = 0; i < x.length; i++) w[i] += c[i] / combs.length;
  }
  w = allpass(allpass(w, 5.0, 0.7), 1.7, 0.7);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = (1 - wet) * x[i] + wet * w[i];
  return out;
}

function normalize(buf, peak) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max < 1e-9) return buf;
  for (let i = 0; i < buf.length; i++) buf[i] *= peak / max;
  return buf;
}

function writeWav(path, buf) {
  const n = buf.length;
  const dv = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  writeFileSync(path, Buffer.from(dv.buffer));
}

for (const [pack, theme] of Object.entries(PACKS)) {
  mkdirSync(resolve(ROOT, 'asset', pack), { recursive: true });
  mkdirSync(resolve(ROOT, 'public/audio', pack), { recursive: true });
  for (const [name, notes] of Object.entries(theme.cues)) {
    const { peak, dRev } = SHAPE[name];
    const total = Math.max(...notes.map(([, o, d]) => o + d));
    const buf = new Float32Array(Math.ceil(total * SR));
    for (const [semi, onset, dur, gain] of notes) {
      const note = bell(semis(theme.root, semi), dur, theme.voice);
      const off = Math.floor(onset * SR);
      for (let i = 0; i < note.length && off + i < buf.length; i++) {
        buf[off + i] += gain * note[i];
      }
    }
    const rendered = reverb(normalize(buf, peak), theme.reverb + dRev);
    const wav = resolve(ROOT, 'asset', pack, `cue-${name}.wav`);
    const ogg = resolve(ROOT, 'public/audio', pack, `cue-${name}.ogg`);
    writeWav(wav, rendered);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', wav,
      '-c:a', 'libopus', '-b:a', '96k', '-ac', '1', ogg,
    ]);
  }
  console.log(`✓ ${pack}  (root ${theme.root}Hz, ${theme.voice})`);
}
console.log('Done. WAV masters → asset/<pack>/, Opus → public/audio/<pack>/');
