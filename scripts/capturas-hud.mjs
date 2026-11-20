// Capturas de revisión de la numeración (npm run build && node scripts/capturas-hud.mjs):
//   · docs/capturas/hud/<vista>-<etapa>.jpg  → HUD junto al texto de la etapa en 00, 03 (dos estados), 05 (dos estados), 08 y 09
//   · docs/capturas/hud/lista-<vista>.jpg    → lista desplegada del HUD
//   · docs/capturas/1080/clip-<id>.jpg       → los clips en 1920×1080 (CLIPS=precinto,tienda)
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const file = (rel) => fileURLToPath(new URL(`../docs/capturas/${rel}`, import.meta.url));
mkdirSync(file('hud/'), { recursive: true });
mkdirSync(file('1080/'), { recursive: true });
const VP = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  fhd: { viewport: { width: 1920, height: 1080 } },
};
const server = await preview({ preview: { port: 4188, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist'] });
const open = async (name, q = '') => {
  const ctx = await browser.newContext(VP[name]);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:4188/?medir=1${q}`);
  await page.waitForFunction(() => window.__journey && !document.querySelector('.loader'), null, { timeout: 60000 });
  await page.waitForTimeout(600);
  return { ctx, page };
};
const seek = async (page, u) => {
  await page.evaluate((u) => window.__journey.seek(u), u);
  await page.waitForTimeout(700);
};

for (const name of ['desktop', 'mobile']) {
  const { ctx, page } = await open(name);
  const st = await page.evaluate(() => [3, 5, 8].map((i) => window.__journey.station(i)));
  const sub = await page.evaluate(() => [...document.querySelectorAll('#tracker-list li.is-sub a')].map((a) => Number(a.dataset.u)));
  const list = [
    ['00', 0.001],
    ['03-condiciones', st[0]],
    ['03-proveedor', sub[0]],
    ['05-cargado', st[1]],
    ['05-embarcado', sub[1]],
    ['08', st[2]],
    ['09', 9.7],
  ];
  for (const [tag, u] of list) {
    await seek(page, u);
    await page.screenshot({ path: file(`hud/${name}-${tag}.jpg`), type: 'jpeg', quality: 82 });
  }
  await seek(page, sub[1]);
  await page.click('.tracker__toggle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: file(`hud/lista-${name}.jpg`), type: 'jpeg', quality: 85 });
  await ctx.close();
}

const CLIPS = (process.env.CLIPS || 'precinto,tienda').split(',');
const { ctx, page } = await open('fhd', '&grano=0');
await page.addStyleTag({ content: '.etapa__content,.tracker,.viaje,.header,#dev{visibility:hidden!important}' });
for (const id of CLIPS) {
  const u = await page.evaluate((id) => {
    const it = window.__clips.clips.find((c) => c.id === id);
    return it.slot[0] + it.slot[1] * 0.5; // mitad del clip (video en movimiento)
  }, id);
  await seek(page, u - 0.3);
  await page.waitForFunction((id) => window.__clips.clips.find((c) => c.id === id).state === 'ready', id, { timeout: 30000 });
  await seek(page, u);
  await page.waitForTimeout(800);
  await page.screenshot({ path: file(`1080/clip-${id}.jpg`), type: 'jpeg', quality: 93 });
}
await ctx.close();
await browser.close();
await server.close();
