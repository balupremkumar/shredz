import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build runs at any address (GitHub Pages sub-path or a root domain).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'safari17' },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
