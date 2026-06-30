import { defineConfig } from 'vitest/config';

// Unit tests cover the pure, framework-free logic only (src/shared/*), so a
// plain Node environment is enough — no jsdom, no chrome mocking. The build's
// `__ENABLE_TEST_MODE__` compile-time flag is defined here so `minuteMs`'s
// test-mode branch is reachable (tests still opt in via `settings.testMode`).
export default defineConfig({
  define: { __ENABLE_TEST_MODE__: 'true' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
