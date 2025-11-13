import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/lets-kho-multiplayer/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
