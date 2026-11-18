import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { renderPage } from './src/content/render.js';

const root = fileURLToPath(new URL('.', import.meta.url));

// Inyecta el contenido de src/content/<idioma>.json en index.html (al servir y al compilar).
function contentPlugin(lang) {
  const file = resolve(root, `src/content/${lang}.json`);
  return {
    name: 'contenido-html',
    configureServer(server) {
      server.watcher.add(file);
      server.watcher.on('change', (changed) => {
        if (resolve(changed) === file) server.ws.send({ type: 'full-reload' });
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const content = JSON.parse(readFileSync(file, 'utf8'));
        return renderPage(html, content, lang);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  const lang = env.VITE_LANG || 'es';
  return {
    plugins: [contentPlugin(lang)],
    server: { port: 5174, strictPort: true },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 900,
      // prototipos de comparación (rama prototipo-avance): páginas separadas, no tocan el recorrido principal
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          lateral: resolve(root, 'prototipo-lateral.html'),
          zoom: resolve(root, 'prototipo-zoom.html'),
          video: resolve(root, 'prototipo-video.html'),
        },
      },
    },
  };
});
