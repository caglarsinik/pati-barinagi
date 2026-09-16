import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  // Üretimde oyun tek bir dist/index.html içine gömülür (çift tıkla açılır); manifest, ikonlar ve service worker
  // public/ klasöründen dist/ yanına kopyalanır (PWA / yayın için).
  plugins: command === 'build' ? [viteSingleFile()] : [],
  // Göreli yollar: GitHub Pages alt yolu (/pati-barinagi/) ve file:// ikisinde de çalışır.
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 6000,
    cssCodeSplit: false,
  },
}));
