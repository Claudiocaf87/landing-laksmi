// Captura el globo 3D (hero y cierre) como imagen fija para la versión sin WebGL / ahorro de datos.
// Uso: npm run build && node scripts/capturar-globo.mjs   → assets-fuente/globo-hero.png, globo-cierre.png
// Después: npm run imagenes (los convierte a AVIF/WebP en public/assets/fotos/).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await preview({ preview: { port: 4182, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await page.goto('http://localhost:4182/?medir=1');
await page.waitForFunction(() => window.__stage && !document.querySelector('.loader'), null, { timeout: 60000 });
await page.waitForTimeout(3500); // que la ruta termine de dibujarse
await page.addStyleTag({ content: '.header, .tracker, .etapa__content, .scroll-hint, .foto { visibility: hidden !important; }' });

for (const [name, u] of [
  ['hero', 0.3],
  ['cierre', 9.7],
]) {
  await page.evaluate((u) => window.__journey.seek(u), u);
  await page.waitForTimeout(600);
  const box = await page.evaluate(() => {
    const s = window.__stage;
    const g = s.globe ? s.scene.children[0] : null;
    const spin = g.children[0];
    const c = g.getWorldPosition(new s.camera.position.constructor());
    const d = c.distanceTo(s.camera.position);
    const R = 10 * spin.scale.x * 1.09; // incluye el halo
    const v = c.clone().project(s.camera);
    const cx = ((v.x + 1) / 2) * innerWidth;
    const cy = ((1 - v.y) / 2) * innerHeight;
    const r = (Math.tan(Math.asin(Math.min(0.99, R / d))) / Math.tan((s.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
    return { x: Math.max(0, cx - r), y: Math.max(0, cy - r), width: Math.min(innerWidth, 2 * r), height: Math.min(innerHeight, 2 * r) };
  });
  await page.screenshot({ path: fileURLToPath(new URL(`../assets-fuente/globo-${name}.png`, import.meta.url)), clip: box });
  console.log(name, box);
}
await browser.close();
await server.close();
