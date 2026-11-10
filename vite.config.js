import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: { preserveSymlinks: true },
  // JSDOM tests evaluate one script; production keeps real lazy-loaded chunks.
  build: mode === 'test' ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
}));
