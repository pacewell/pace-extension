// Removes the developer-only Options page from the built store manifest.
//
// The Options page (`options_ui`) holds nothing but the dev test-mode toggle, so
// the public Web Store build must not expose it. Run after `vite build --mode
// store` (see the `build:store` npm script); a no-op if dist/manifest.json has
// already been stripped.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const manifestPath = resolve(dist, 'manifest.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if ('options_ui' in manifest) {
  delete manifest.options_ui;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('✓ stripped options_ui from store manifest');
} else {
  console.log('· options_ui already absent');
}
