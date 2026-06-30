import { defineConfig } from '@playwright/test';

/**
 * End-to-end smoke tests. These load the *built* extension from `dist/`, so run
 * `npm run build` first (the `e2e` npm script does). Scope is deliberately a
 * thin happy-path pass over the cross-context wiring (popup ↔ background ↔
 * content) that the Vitest unit tests can't reach; the pure logic stays in
 * Vitest. Serial, single worker — one shared browser profile per run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Extension e2e can be occasionally flaky on CI runners; retry there only so a
  // transient hiccup doesn't fail the run, while local failures stay honest.
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
});
