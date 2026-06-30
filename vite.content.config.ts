import { defineConfig } from 'vite';

// Content scripts cannot be ES modules, so this second pass bundles the
// content script as a self-contained IIFE into the same dist folder.
export default defineConfig(({ mode }) => ({
  publicDir: false,
  // Kept in sync with vite.config.ts so any shared code the content script
  // pulls in (e.g. schedule.ts) resolves the same compile-time flag.
  define: {
    __ENABLE_TEST_MODE__: JSON.stringify(mode !== 'store'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    lib: {
      entry: 'src/content/index.ts',
      formats: ['iife'],
      name: 'paceContent',
      fileName: () => 'content.js',
    },
  },
}));
