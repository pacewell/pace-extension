// Turns the downloaded ambient recordings into seamless, loudness-matched loops.
//
//   node tools/audio/loopify.mjs
//
// For each pack it reads asset/<pack>/src.wav and writes public/audio/<pack>/loop.ogg:
//   1. optional trim to a target length (keeps the package small),
//   2. EBU R128 loudness normalization to a shared target (so switching packs
//      doesn't jump in volume), peak-limited to avoid clipping,
//   3. a self-crossfade (acrossfade) so the end blends into the start — the
//      naive end→start seam click is hidden inside the fade and the new loop
//      boundary lands on originally-contiguous audio,
//   4. Opus encode (~half the size of MP3, native in Chrome).
//
// NOTE: crossfading removes the *click*; a recording with a fixed melodic/▸
// phrase can still audibly "restart". These three are stationary textures
// (rain / forest / café chatter) so they loop cleanly.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const LOUDNESS = 'loudnorm=I=-20:TP=-1.5:LRA=11';
const XFADE = 4; // seconds of self-crossfade
const BITRATE = '96k';

// trim: [startSec, durationSec] or null to keep the whole file.
const PACKS = {
  rain: { trim: [20, 90] }, // 157s → a steady 90s window
  forest: { trim: null }, // 54s, keep all
  cafe: { trim: null }, // 90s, keep all
};

for (const [pack, cfg] of Object.entries(PACKS)) {
  const src = resolve(ROOT, 'asset', pack, 'src.wav');
  if (!existsSync(src)) {
    console.warn(`• skip ${pack}: ${src} missing`);
    continue;
  }
  const outDir = resolve(ROOT, 'public/audio', pack);
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, 'loop.ogg');

  const pre = cfg.trim
    ? `atrim=start=${cfg.trim[0]}:duration=${cfg.trim[1]},asetpts=N/SR/TB,`
    : '';
  const filter =
    `[0:a]${pre}${LOUDNESS},asplit[a][b];` +
    `[a]atrim=start=${XFADE},asetpts=N/SR/TB[body];` +
    `[b]atrim=end=${XFADE},asetpts=N/SR/TB[head];` +
    `[body][head]acrossfade=d=${XFADE}:c1=tri:c2=tri[out]`;

  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    src,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-c:a',
    'libopus',
    '-b:a',
    BITRATE,
    out,
  ]);
  console.log(`✓ ${pack} → public/audio/${pack}/loop.ogg`);
}
console.log('Done.');
