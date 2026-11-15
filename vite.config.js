import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'frontend'),
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: resolve(__dirname, 'frontend', 'index.html'),
    },
  },
});