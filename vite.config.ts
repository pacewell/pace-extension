import { defineConfig } from 'vite';

// Builds the popup, offscreen document and the background service worker
// as ES modules. The content script needs an IIFE bundle and is built by
// vite.content.config.ts in a second pass.
//
// Default `npm run build` keeps the developer test mode. `npm run build:store`
// passes `--mode store`, which strips it: the Options page is dropped from the
// bundle, `__ENABLE_TEST_MODE__` compiles to false (dead-code-eliminating the
// time compression), and tools/strip-dev-manifest.mjs removes `options_ui` from
// the emitted manifest.
export default defineConfig(({ mode }) => {
  const enableTestMode = mode !== 'store';

  const input: Record<string, string> = {
    background: 'src/background/index.ts',
    popup: 'src/popup/popup.html',
    offscreen: 'src/offscreen/offscreen.html',
  };
  // The Options page is developer-only — omit it from the store build.
  if (enableTestMode) input.options = 'src/options/options.html';

  return {
    define: {
      __ENABLE_TEST_MODE__: JSON.stringify(enableTestMode),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'chrome116',
      modulePreload: false,
      rollupOptions: {
        input,
        output: {
          entryFileNames: (chunk) =>
            chunk.name === 'background' ? 'background.js' : 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  };
});
