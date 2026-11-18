// Medición sobre el build de producción (npm run build && npm run medir).
// Abre Chrome con ventana (GPU real) vía Playwright y mide:
//   · peso de la carga inicial (bytes transferidos hasta que el hero está listo, vía CDP)
//   · fps promedio, mínimo (peor ventana de 0,5 s) y 1 % low, normal y con CPU 4x
//   · largo total de scroll en desktop (1440×900) y mobile (390×844)
// Además guarda capturas por etapa en docs/capturas/ y, con VIDEO=1, videos del scroll en docs/videos/.
// SOLO=capturas → solo capturas (sin fps). U=2.3,5.4 → capturas extra en esos u. SEG=3 → segundos por etapa.
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
const OUT = new URL('../docs/', import.meta.url);
const file = (rel) => fileURLToPath(new URL(rel, OUT));
mkdirSync(file('capturas/'), { recursive: true });
mkdirSync(file('videos/'), { recursive: true });
const SEG = Number(process.env.SEG || 3);
const SOLO = process.env.SOLO === 'capturas';
const VIDEO = process.env.VIDEO === '1';
const EXTRA = (process.env.U || '').split(',').filter(Boolean).map(Number);

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'warn' });
const url = 'http://localhost:4179/?medir=1';
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-position=40,40'],
});

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function open(name, { video = false } = {}) {
  const opts = { ...VIEWPORTS[name] };
  if (video) opts.recordVideo = { dir: file('videos/'), size: opts.viewport };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  let bytes = 0;
  const byType = {};
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  cdp.on('Network.responseReceived', (e) => (byType[e.requestId] = e.type));
  await page.goto(url);
  await page.waitForFunction(() => window.__journey && !document.querySelector('.loader'), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page, cdp, initialBytes: bytes };
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function captures(page, tag) {
  const N = await page.evaluate(() => window.__journey.N);
  await page.evaluate(() => window.__journey.loadAll());
  await page.waitForTimeout(1500);
  for (let i = 0; i < N; i++) {
    const u = await page.evaluate((i) => window.__journey.station(i), i);
    await page.evaluate((u) => window.__journey.seek(u), u === 0 ? 0.001 : u);
    await frames(page, 4);
    await page.screenshot({ path: file(`capturas/${tag}-etapa-${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 74 });
  }
  for (const u of EXTRA) {
    await page.evaluate((u) => window.__journey.seek(u), u);
    await frames(page, 4);
    await page.screenshot({ path: file(`capturas/${tag}-u${u.toFixed(2)}.jpg`), type: 'jpeg', quality: 74 });
  }
}

// recorre todo el journey a velocidad constante y registra la duración de cada fotograma
const fpsRun = (page) =>
  page.evaluate(async (sec) => {
    const j = window.__journey;
    const from = j.scrollForU(0);
    const total = j.scrollForU(j.N) - from;
    j.seek(0);
    await new Promise((r) => setTimeout(r, 400));
    const dur = j.N * sec * 1000;
    const times = [];
    let worst = { ms: 0 };
    return new Promise((resolve) => {
      let start = null;
      let last = null;
      const f = (now) => {
        if (start === null) start = last = now;
        const t = (now - start) / dur;
        j.lenis.scrollTo(from + Math.min(1, t) * total, { immediate: true, force: true });
        if (now !== last) {
          times.push(now - last);
          if (now - last > worst.ms) worst = { ms: +(now - last).toFixed(1), u: +j.proxy.u.toFixed(2) };
        }
        last = now;
        if (t < 1) return requestAnimationFrame(f);
        const sum = times.reduce((a, b) => a + b, 0);
        const sorted = [...times].sort((a, b) => b - a);
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
        resolve({ avgFps: +((times.length * 1000) / sum).toFixed(1), minFps: +minFps.toFixed(1), low1: +(1000 / sorted[Math.floor(sorted.length * 0.01)]).toFixed(1), worstFrame: worst });
      };
      requestAnimationFrame(f);
    });
  }, SEG);

const scrollLength = (page) =>
  page.evaluate(() => {
    const vh = window.innerHeight;
    const total = document.documentElement.scrollHeight - vh;
    const j = document.querySelector('.journey');
    return { totalPx: total, totalScreens: +(total / vh).toFixed(1), journeyPx: j.offsetHeight - vh, journeyScreens: +((j.offsetHeight - vh) / vh).toFixed(1) };
  });

const result = { fecha: new Date().toISOString(), navegador: CHROME };
for (const name of ['desktop', 'mobile']) {
  const { ctx, page, cdp, initialBytes } = await open(name);
  const r = (result[name] = { cargaInicialKB: +(initialBytes / 1024).toFixed(1), scroll: await scrollLength(page) });
  r.globo3D = await page.evaluate(() => Boolean(window.__stage));
  await captures(page, name);
  if (!SOLO) {
    r.fps = await fpsRun(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    r.fpsCpu4x = await fpsRun(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await ctx.close();
  if (VIDEO) {
    const v = await open(name, { video: true });
    await v.page.evaluate(() => window.__journey.seek(0));
    await v.page.waitForTimeout(1500);
    // scroll suave de punta a punta (incluye los bloques HTML del final)
    await v.page.evaluate(async (sec) => {
      const j = window.__journey;
      const end = document.documentElement.scrollHeight - innerHeight;
      await new Promise((resolve) => {
        const dur = (j.N + 2) * sec * 1000;
        const t0 = performance.now();
        const f = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          j.lenis.scrollTo(t * end, { immediate: true, force: true });
          if (t < 1) requestAnimationFrame(f);
          else resolve();
        };
        requestAnimationFrame(f);
      });
    }, 2.6);
    await v.page.waitForTimeout(800);
    const path = await v.page.video().path();
    await v.ctx.close();
    renameSync(path, file(`videos/scroll-${name}.webm`));
  }
}
await browser.close();
await server.close();
writeFileSync(file('medicion-fase3.json'), JSON.stringify(result, null, 2));
for (const name of ['desktop', 'mobile']) {
  const d = result[name];
  console.log(`\n== ${name} == globo 3D: ${d.globo3D} · carga inicial: ${d.cargaInicialKB} KB`);
  console.log(`  scroll: total ${d.scroll.totalPx}px (${d.scroll.totalScreens} pantallas) · recorrido ${d.scroll.journeyPx}px (${d.scroll.journeyScreens} pantallas)`);
  if (d.fps) {
    const w = (f) => `peor ${f.worstFrame.ms} ms en u=${f.worstFrame.u}`;
    console.log(`  fps:        prom ${d.fps.avgFps} · mín ${d.fps.minFps} · 1% low ${d.fps.low1} · ${w(d.fps)}`);
    console.log(`  fps CPU 4x: prom ${d.fpsCpu4x.avgFps} · mín ${d.fpsCpu4x.minFps} · 1% low ${d.fpsCpu4x.low1} · ${w(d.fpsCpu4x)}`);
  }
}
