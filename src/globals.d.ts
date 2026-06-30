// Compile-time flags injected by Vite `define` (see vite.config.ts).

/** True in the default dev build, false in the store build (`npm run build:store`).
    Gates the developer-only test mode so it's dead-code-eliminated for the store. */
declare const __ENABLE_TEST_MODE__: boolean;
