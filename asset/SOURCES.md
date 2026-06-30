# Audio sources & provenance

What the shipped audio in `public/audio/<pack>/` is made from, and how to
reproduce it. **Only the generated `public/audio/*.ogg` files are committed.** The
large source recordings (`asset/<pack>/src.wav`) and the synthesized cue masters
(`asset/<pack>/cue-*.wav`) are git-ignored — re-fetch / re-generate as below.

## Ambient loops (real recordings)

All from **BigSoundBank** under **CC0 (public domain)** — free, commercial,
redistributable, no attribution required. Download the WAV to `asset/<pack>/src.wav`,
then run `node tools/audio/loopify.mjs` (trim → −20 LUFS loudness-match →
`acrossfade` seamless loop → Opus).

| Pack   | Source                                                      |
| ------ | ----------------------------------------------------------- |
| rain   | https://bigsoundbank.com/summer-rain-on-terrace-s1019.html  |
| forest | https://bigsoundbank.com/detail-0100-forest.html            |
| cafe   | https://bigsoundbank.com/restaurant-s0624.html              |

## Transition cues (synthesized)

Original additive synthesis — no samples, license-clean. Regenerate with
`node tools/audio/gen-cues.mjs` (writes `asset/<pack>/cue-*.wav` masters + the
shipped `public/audio/<pack>/cue-*.ogg`). Two cues per pack: `break`, `complete`.
