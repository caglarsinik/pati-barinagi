import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  // Üretimde her şey tek bir dist/index.html içine gömülür; çift tıkla açılır.
  plugins: command === 'build' ? [viteSingleFile()] : [],
  server: { port: 5173, host: '127.0.0.1' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 6000,
    cssCodeSplit: false,
  },
}));
