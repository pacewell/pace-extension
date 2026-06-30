import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const pathToExtension = path.resolve(dirname, '../dist');

/**
 * Loads the unpacked extension into a persistent context (the only way Chromium
 * runs an MV3 extension) and exposes its background service worker + id.
 */
export const test = base.extend<{
  context: BrowserContext;
  background: Worker;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },

  background: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    sw ??= await context.waitForEvent('serviceworker');
    await use(sw);
  },

  extensionId: async ({ background }, use) => {
    // chrome-extension://<id>/...
    const id = new URL(background.url()).host;
    await use(id);
  },
});

export const expect = test.expect;

/** Seed storage so a run is fast and deterministic: test mode (1 min → 1 s),
    1-minute focus/break (→ ~1 s each), two sessions, silent (no offscreen audio
    needed in headless). */
export async function seedFastRun(
  background: Worker,
  sessions = 2
): Promise<void> {
  await background.evaluate(async (n) => {
    await chrome.storage.local.set({
      'pace:settings': {
        focusMin: 1,
        breakMin: 1,
        longBreakEnabled: false,
        longBreakInterval: 4,
        longBreakMin: 1,
        sound: 'silent',
        testMode: true,
      },
      'pace:prefs': { sessions: n, ambientOn: false },
    });
    await chrome.storage.local.remove('pace:state');
  }, sessions);
}
