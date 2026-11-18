// Material de revisión (npm run build && npm run revision):
//   · docs/capturas/titulos-{desktop,mobile}.jpg  → todos los títulos con g, j, p, q o y
//   · docs/capturas/final-{desktop,mobile}-*.jpg  → etapa final (foto sola y globo + resultados)
//   · docs/videos/hero-{desktop,mobile}.webm      → giro del globo del hero
// Requiere Pillow para armar las hojas (python).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const file = (rel) => fileURLToPath(new URL(`../docs/${rel}`, import.meta.url));
mkdirSync(file('capturas/titulos/'), { recursive: true });
mkdirSync(file('videos/'), { recursive: true });
const server = await preview({ preview: { port: 4184, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist'] });
const VP = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const report = {};

for (const [name, opts] of Object.entries(VP)) {
  // ---- títulos con descendentes ----
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4184/?medir=1');
  await page.waitForFunction(() => window.__journey && !document.querySelector('.loader'));
  await page.evaluate(() => window.__journey.loadAll());
  await page.waitForTimeout(1500);
  const N = await page.evaluate(() => window.__journey.N);
  const shots = [];
  for (let i = 0; i < N; i++) {
    const u = await page.evaluate((i) => window.__journey.station(i), i);
    await page.evaluate((u) => window.__journey.seek(u), i === 0 ? 0.001 : u);
    await page.waitForTimeout(150);
    const t = page.locator(`.etapa[data-etapa="${i}"] .etapa__title`);
    if (/[gjpqy]/.test(await t.textContent())) {
      const path = file(`capturas/titulos/${name}-${String(i).padStart(2, '0')}.png`);
      await t.screenshot({ path });
      shots.push(path);
    }
  }
  // títulos de los bloques HTML (después del recorrido)
  for (const sel of ['#rubros .block__title', '#testimonios .block__title', '#preguntas .block__title', '#tu-caso .block__title', '#cotizar .block__title']) {
    const t = page.locator(sel);
    if (!/[gjpqy]/.test(await t.textContent())) continue;
    await t.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.__journey.lenis.resize());
    await page.waitForTimeout(300);
    const path = file(`capturas/titulos/${name}-${sel.split(' ')[0].slice(1)}.png`);
    await t.screenshot({ path });
    shots.push(path);
  }
  // ---- etapa final: foto sola y después globo + resultados ----
  for (const [tag, u] of [
    ['foto', 9.18],
    ['globo', 9.72],
  ]) {
    await page.evaluate((u) => window.__journey.seek(u), u);
    await page.waitForTimeout(500);
    await page.screenshot({ path: file(`capturas/final-${name}-${tag}.jpg`), type: 'jpeg', quality: 80 });
  }
  report[name] = await page.evaluate(() => document.querySelector('.etapa[data-cierre] .foto img').currentSrc.split('/').pop());
  await ctx.close();
  writeFileSync(file(`capturas/titulos/${name}.txt`), shots.join('\n'));

  // ---- video del hero: 10 s sin scroll (animación de entrada) y después scroll hasta la etapa 01 ----
  const v = await browser.newContext({ ...opts, recordVideo: { dir: file('videos/'), size: opts.viewport } });
  const vp = await v.newPage();
  await vp.goto('http://localhost:4184/?medir=1');
  await vp.waitForFunction(() => window.__journey && !document.querySelector('.loader'));
  await vp.waitForTimeout(10000);
  await vp.evaluate(
    () =>
      new Promise((resolve) => {
        const j = window.__journey;
        const to = j.scrollForU(1.4);
        const t0 = performance.now();
        const f = (now) => {
          const t = Math.min(1, (now - t0) / 5000);
          j.lenis.scrollTo(t * to, { immediate: true, force: true });
          if (t < 1) requestAnimationFrame(f);
          else resolve();
        };
        requestAnimationFrame(f);
      }),
  );
  await vp.waitForTimeout(700);
  const path = await vp.video().path();
  await v.close();
  renameSync(path, file(`videos/hero-${name}.webm`));
}
await browser.close();
await server.close();
console.log('foto final servida:', report);

// hojas con todos los títulos
execFileSync('python', ['-c', `
from PIL import Image, ImageDraw
import sys
base = sys.argv[1]
for name in ['desktop', 'mobile']:
    paths = open(base + '/titulos/' + name + '.txt', encoding='utf8').read().splitlines()
    ims = [Image.open(p).convert('RGB') for p in paths if p]
    w = max(i.width for i in ims) + 40
    h = sum(i.height + 24 for i in ims) + 20
    s = Image.new('RGB', (w, h), '#F7F3EE'); d = ImageDraw.Draw(s); y = 10
    for i in ims:
        s.paste(i, (20, y)); d.rectangle((19, y - 1, 20 + i.width, y + i.height), outline='#C9A24A'); y += i.height + 24
    s.save(base + '/titulos-' + name + '.jpg', quality=88)
`, file('capturas').replaceAll('\\', '/')]);
