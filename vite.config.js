import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: { preserveSymlinks: true },
  // Generated graphs and QA pages must not reload a local draft in progress.
  server: { watch: { ignored: /[\\/](graphify-out|test-results)[\\/]/ } },
  // JSDOM tests evaluate one script; production keeps real lazy-loaded chunks.
  build: mode === 'test' ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
}));
