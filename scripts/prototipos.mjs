// Mide y graba los tres prototipos (npm run build && node scripts/prototipos.mjs).
//   · capturas en docs/capturas/proto-<version>-<vista>-p<progreso>.jpg
//   · fps promedio / mínimo (peor ventana de 0,5 s) en desktop y mobile con CPU 4x
//   · bytes transferidos por tipo (imágenes, profundidad, video, JS) para estimar el peso extra
//   · VIDEO=1 → docs/videos/proto-<version>-<vista>.webm (todo el tramo)
// SOLO=lateral,zoom → solo esas versiones. FPS=12 → la versión C usa la variante de 12 fps.
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const file = (rel) => fileURLToPath(new URL(`../docs/${rel}`, import.meta.url));
mkdirSync(file('capturas/'), { recursive: true });
mkdirSync(file('videos/'), { recursive: true });
const VERSIONS = (process.env.SOLO || 'lateral,zoom,video').split(',');
const VIDEO = process.env.VIDEO === '1';
const VP = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const server = await preview({ preview: { port: 4185, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });

async function open(version, name, { video = false } = {}) {
  const opts = { ...VP[name] };
  if (video) opts.recordVideo = { dir: file('videos/'), size: opts.viewport };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const bytes = {};
  const urls = {};
  cdp.on('Network.responseReceived', (e) => (urls[e.requestId] = e.response.url));
  cdp.on('Network.loadingFinished', (e) => {
    const u = urls[e.requestId] || '';
    const k = /\/profundidad\//.test(u) ? 'profundidad' : /\/video\//.test(u) ? 'video' : /\.(webp|avif|jpg|png)/.test(u) ? 'fotos' : /\.js/.test(u) ? 'js' : /\.css/.test(u) ? 'css' : 'otros';
    bytes[k] = (bytes[k] || 0) + e.encodedDataLength;
  });
  page.on('pageerror', (e) => console.log('  [error]', e.message));
  await page.goto(`http://localhost:4185/prototipo-${version}.html${process.env.FPS === '12' ? '?fps=12' : ''}`);
  await page.waitForFunction(() => window.__proto);
  await page.waitForTimeout(1800);
  return { ctx, page, cdp, bytes };
}

// recorre el tramo a velocidad constante (el mismo método que con la versión principal)
const fpsRun = (page, seconds) =>
  page.evaluate(async (dur) => {
    const pr = window.__proto;
    const from = pr.scrollForP(0);
    const to = pr.scrollForP(1);
    pr.seek(0);
    await new Promise((r) => setTimeout(r, 300));
    const times = [];
    return new Promise((resolve) => {
      let start = null;
      let last = null;
      const f = (now) => {
        if (start === null) start = last = now;
        const t = (now - start) / (dur * 1000);
        pr.lenis.scrollTo(from + Math.min(1, t) * (to - from), { immediate: true, force: true });
        if (now !== last) times.push(now - last);
        last = now;
        if (t < 1) return requestAnimationFrame(f);
        const sum = times.reduce((a, b) => a + b, 0);
        let minFps = Infinity;
        let acc = 0;
        let cnt = 0;
        let i0 = 0;
        for (let i = 0; i < times.length; i++) {
          acc += times[i];
          cnt++;
          while (acc > 500) {
            minFps = Math.min(minFps, (cnt * 1000) / acc);
            acc -= times[i0++];
            cnt--;
          }
        }
        resolve({ avg: +((times.length * 1000) / sum).toFixed(1), min: +minFps.toFixed(1) });
      };
      requestAnimationFrame(f);
    });
  }, seconds);

const result = {};
for (const v of VERSIONS) {
  for (const name of ['desktop', 'mobile']) {
    const { ctx, page, cdp, bytes } = await open(v, name);
    for (const p of [0.02, 0.3, 0.55, 0.62, 0.8, 0.98]) {
      await page.evaluate((p) => window.__proto.seek(p), p);
      await page.waitForTimeout(v === 'video' ? 500 : 250);
      await page.screenshot({ path: file(`capturas/proto-${v}-${name}-p${p.toFixed(2)}.jpg`), type: 'jpeg', quality: 72 });
    }
    const r = { fps: await fpsRun(page, 12) };
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    r.fpsCpu4x = await fpsRun(page, 12);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    r.kb = Object.fromEntries(Object.entries(bytes).map(([k, b]) => [k, +(b / 1024).toFixed(1)]));
    if (v === 'video') r.videoState = await page.evaluate(() => window.__video);
    result[`${v}-${name}`] = r;
    console.log(`${v.padEnd(8)} ${name.padEnd(8)} fps ${r.fps.avg}/${r.fps.min} · CPU4x ${r.fpsCpu4x.avg}/${r.fpsCpu4x.min} · KB ${JSON.stringify(r.kb)}${r.videoState ? ' · ' + JSON.stringify(r.videoState) : ''}`);
    await ctx.close();
    if (VIDEO) {
      const rec = await open(v, name, { video: true });
      await rec.page.evaluate(async () => {
        const pr = window.__proto;
        const end = pr.scrollForP(1);
        await new Promise((resolve) => {
          const t0 = performance.now();
          const f = (now) => {
            const t = Math.min(1, (now - t0) / 14000);
            // ida suave con una pausa al final
            pr.lenis.scrollTo(end * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2), { immediate: true, force: true });
            if (t < 1) requestAnimationFrame(f);
            else resolve();
          };
          requestAnimationFrame(f);
        });
      });
      await rec.page.waitForTimeout(800);
      const path = await rec.page.video().path();
      await rec.ctx.close();
      renameSync(path, file(`videos/proto-${v}-${name}.webm`));
    }
  }
}
writeFileSync(file('medicion-prototipos.json'), JSON.stringify(result, null, 2));
await browser.close();
await server.close();
