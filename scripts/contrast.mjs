// Contraste real del texto sobre el 3D (npm run build && npm run contraste).
// En cada estación: anota el color y el rectángulo de cada línea de texto, lo vuelve transparente,
// captura el fondo que queda detrás (escena + degradado + fondos de chips) y calcula la relación
// WCAG contra el percentil 95 de luminancia del fondo (el peor caso razonable, no el promedio).
// Umbral: 4,5:1 para texto normal, 3:1 para títulos grandes (≥ 24 px o ≥ 18,7 px en negrita).
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await preview({ preview: { port: 4181, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist'] });

const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const viewports = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
];
const only = process.env.ETAPAS ? process.env.ETAPAS.split(',').map(Number) : null;
let fails = 0;
// momentos con el texto completamente visible: entrada, estación y antes de salir
const OFFSETS = (process.env.OFFSETS || '0.2,0.5,0.75').split(',').map(Number);

for (const vp of viewports) {
  const ctx = await browser.newContext(vp);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4181/?medir=1');
  await page.waitForFunction(() => window.__journey && !document.querySelector('.loader'), null, { timeout: 60000 });
  const N = await page.evaluate(() => window.__journey.N);
  console.log(`\n== ${vp.name} ==`);
  for (let j = 0; j < N * OFFSETS.length; j++) {
    const i = Math.floor(j / OFFSETS.length);
    const u = i + OFFSETS[j % OFFSETS.length];
    if (only && !only.includes(i)) continue;
    await page.evaluate((u) => window.__journey.seek(u), u);
    await page.waitForTimeout(250);
    const items = await page.evaluate((i) => {
      const inner = document.querySelectorAll('.etapa__inner')[i];
      const sel = '.kicker, .etapa__title span, .etapa__sub, .points li, .chips li, .stat dt, .stat dd, .note, .minimap figcaption span, .btn';
      return [...inner.querySelectorAll(sel)].map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const [cr, cg, cb] = cs.color.match(/\d+(\.\d+)?/g).map(Number);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const own = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !cs.backgroundColor.endsWith(', 0)');
        return { label: (el.className || el.tagName).toString().split(' ')[0] + ': ' + el.textContent.trim().slice(0, 28), x: r.x, y: r.y, w: r.width, h: r.height, color: [cr, cg, cb], large: size >= 24 || (bold && size >= 18.66), solid: own && el.classList.contains('btn') };
      });
    }, i);
    // texto transparente → queda solo el fondo
    await page.addStyleTag({ content: '.etapa__inner, .etapa__inner * { color: transparent !important; } .etapa__inner svg { visibility: hidden; }' }).then((h) => h.evaluate((n) => n.setAttribute('data-tmp', '')));
    const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
    await page.evaluate(() => document.querySelectorAll('style[data-tmp]').forEach((s) => s.remove()));
    const dpr = png.width / vp.viewport.width;
    let worst = null;
    for (const it of items) {
      if (it.w < 2 || it.h < 2 || it.solid) continue;
      const L = [];
      for (let y = Math.floor(it.y * dpr); y < Math.min(png.height, (it.y + it.h) * dpr); y += 2)
        for (let x = Math.floor(it.x * dpr); x < Math.min(png.width, (it.x + it.w) * dpr); x += 2) {
          const k = (y * png.width + x) * 4;
          L.push(lum(png.data[k], png.data[k + 1], png.data[k + 2]));
        }
      if (!L.length) continue;
      L.sort((a, b) => a - b);
      const bg = L[Math.floor(L.length * 0.95)];
      const r = ratio(lum(...it.color), bg);
      const min = it.large ? 3 : 4.5;
      if (!worst || r / min < worst.r / worst.min) worst = { ...it, r, min };
      if (r < min) {
        fails++;
        console.log(`  ✘ u=${u.toFixed(2)}  ${r.toFixed(2)}:1 (mín ${min})  ${it.label}`);
      }
    }
    if (worst) console.log(`  u=${u.toFixed(2)}: peor ${worst.r.toFixed(2)}:1 (mín ${worst.min}) → ${worst.label}`);
  }
  await ctx.close();
}
console.log(fails ? `\n${fails} textos por debajo del mínimo` : '\nTodos los textos cumplen WCAG AA');
await browser.close();
await server.close();
