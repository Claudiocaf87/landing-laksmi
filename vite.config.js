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

// Indexación: mientras PUBLICAR_INDEXABLE no sea "true" (versión de muestra, con placeholders e imágenes
// de IA), cada página lleva <meta name="robots" content="noindex, nofollow"> y robots.txt bloquea todo.
function robotsPlugin(indexable) {
  const robots = indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
  return {
    name: 'robots',
    transformIndexHtml(html) {
      if (indexable) return html;
      return html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />');
    },
    configureServer(server) {
      server.middlewares.use('/robots.txt', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(robots);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const lang = env.VITE_LANG || 'es';
  const indexable = String(env.PUBLICAR_INDEXABLE ?? process.env.PUBLICAR_INDEXABLE ?? 'false').toLowerCase() === 'true';
  return {
    plugins: [contentPlugin(lang), robotsPlugin(indexable)],
    server: { port: 5174, strictPort: true },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 900,
    },
  };
});
