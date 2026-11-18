// Medición de rendimiento sobre el build de producción (npm run build && npm run medir).
// Abre Chrome (con ventana, para usar la GPU real) vía Playwright y mide:
//   · draw calls y triángulos en cada estación (u = i + 0,5) y el máximo de todo el recorrido
//   · fps promedio, mínimo (peor ventana de 0,5 s) y 1 % low, normal y con CPU 4x (CDP)
//   · largo total de scroll en desktop (1440×900) y mobile (390×844, táctil → modo liviano)
// Guarda capturas en docs/capturas/ y los números en docs/medicion-fase2.json.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
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
mkdirSync(new URL('capturas/', OUT), { recursive: true });
const SECONDS_PER_STAGE = Number(process.env.SEG || 3);

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'warn' });
const url = 'http://localhost:4179/?medir=1';
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-position=40,40'],
});

async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__journey && !document.querySelector('.loader'), null, { timeout: 60000 });
  await page.evaluate(() => window.__stage.deferred); // carteles, pantalla y recorte
  await page.waitForTimeout(600);
  return { ctx, page };
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function stations(page, tag) {
  const N = await page.evaluate(() => window.__journey.N);
  const rows = [];
  for (let i = 0; i < N; i++) {
    const u = i + 0.5;
    await page.evaluate((u) => window.__journey.seek(u), u);
    await frames(page, 4);
    const r = await page.evaluate(() => {
      const s = window.__stage;
      const { calls, triangles } = s.renderer.info.render;
      return { u: s.u, set: s.set, calls, triangles };
    });
    rows.push(r);
    await page.screenshot({ path: fileURLToPath(new URL(`capturas/${tag}-estacion-${String(i).padStart(2, '0')}.jpg`, OUT)), type: 'jpeg', quality: 72 });
  }
  // momentos intermedios para revisar a ojo (U=4.05,4.28 …)
  for (const u of (process.env.U || '').split(',').filter(Boolean).map(Number)) {
    await page.evaluate((u) => window.__journey.seek(u), u);
    await frames(page, 4);
    await page.screenshot({ path: fileURLToPath(new URL(`capturas/${tag}-u${u.toFixed(2)}.jpg`, OUT)), type: 'jpeg', quality: 72 });
  }
  if (process.env.SOLO === 'capturas') return { rows, worst: {}, worstTris: {} };
  // barrido fino de todo el recorrido para encontrar el peor fotograma
  const sweep = await page.evaluate(async (N) => {
    let worst = { calls: 0 };
    let worstTris = { triangles: 0 };
    for (let u = 0; u < N; u += 0.01) {
      window.__journey.seek(u);
      const s = window.__stage;
      s.measureAt(u);
      const { calls, triangles } = s.renderer.info.render;
      if (calls > worst.calls) worst = { u: +u.toFixed(2), set: s.set, calls, triangles };
      if (triangles > worstTris.triangles) worstTris = { u: +u.toFixed(2), set: s.set, calls, triangles };
    }
    return { worst, worstTris };
  }, N);
  return { rows, ...sweep };
}

// recorre todo el journey a velocidad constante y registra la duración de cada fotograma
async function fpsRun(page) {
  return page.evaluate(async (secPerStage) => {
    const j = window.__journey;
    const total = j.scrollForU(j.N) - j.scrollForU(0);
    j.seek(0);
    await new Promise((r) => setTimeout(r, 400));
    const dur = j.N * secPerStage * 1000;
    const times = [];
    let worst = {};
    return new Promise((resolve) => {
      let start = null;
      let last = null;
      const f = (now) => {
        if (start === null) start = last = now;
        const t = (now - start) / dur;
        j.lenis.scrollTo(j.scrollForU(0) + Math.min(1, t) * total, { immediate: true, force: true });
        if (now !== last) {
          times.push(now - last);
          if (now - last > (worst.ms || 0)) worst = { ms: +(now - last).toFixed(1), u: +window.__stage.u.toFixed(3), set: window.__stage.set };
        }
        last = now;
        if (t < 1) requestAnimationFrame(f);
        else {
          const sum = times.reduce((a, b) => a + b, 0);
          const sorted = [...times].sort((a, b) => b - a);
          const p99 = sorted[Math.floor(sorted.length * 0.01)];
          // peor ventana de 500 ms
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
          resolve({ frames: times.length, avgFps: +((times.length * 1000) / sum).toFixed(1), minFps: +minFps.toFixed(1), low1: +(1000 / p99).toFixed(1), worstFrame: worst });
        }
      };
      requestAnimationFrame(f);
    });
  }, SECONDS_PER_STAGE);
}

async function scrollLength(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const total = document.documentElement.scrollHeight - vh;
    const j = document.querySelector('.journey');
    const journey = j.offsetHeight - vh;
    return { viewport: `${window.innerWidth}×${vh}`, totalPx: total, totalScreens: +(total / vh).toFixed(1), journeyPx: journey, journeyScreens: +(journey / vh).toFixed(1) };
  });
}

const result = { fecha: new Date().toISOString(), navegador: CHROME };

// ---------- desktop ----------
{
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  result.gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  result.desktop = { scroll: await scrollLength(page), estaciones: await stations(page, 'desktop') };
  if (process.env.SOLO === 'capturas') {
    // solo capturas: también mobile, sin medir fps
    await ctx.close();
    const m = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await stations(m.page, 'mobile');
    await m.ctx.close();
    await browser.close();
    await server.close();
    console.log(result.desktop.estaciones.rows.map((r) => `${r.u} ${r.set} ${r.calls}`).join('\n'));
    process.exit(0);
  }
  result.desktop.fps = await fpsRun(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  result.desktop.fpsCpu4x = await fpsRun(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
}

// ---------- mobile (táctil → modo liviano, pixel ratio 1) ----------
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  result.mobile = { scroll: await scrollLength(page), estaciones: await stations(page, 'mobile') };
  result.mobile.fps = await fpsRun(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  result.mobile.fpsCpu4x = await fpsRun(page);
  await ctx.close();
}

await browser.close();
await server.close();
writeFileSync(new URL('medicion-fase2.json', OUT), JSON.stringify(result, null, 2));

const table = (rows) => rows.map((r) => `  u=${r.u.toFixed(1)}  ${r.set.padEnd(6)} calls ${String(r.calls).padStart(3)}  tris ${String(r.triangles).padStart(7)}`).join('\n');
console.log(`GPU: ${result.gpu}`);
for (const k of ['desktop', 'mobile']) {
  const d = result[k];
  console.log(`\n== ${k} (${d.scroll.viewport}) ==`);
  console.log(table(d.estaciones.rows));
  console.log(`  peor fotograma: calls ${d.estaciones.worst.calls} (u=${d.estaciones.worst.u}, ${d.estaciones.worst.set}) · tris máx ${d.estaciones.worstTris.triangles} (u=${d.estaciones.worstTris.u})`);
  const w = (f) => `peor ${f.worstFrame.ms} ms en u=${f.worstFrame.u} (${f.worstFrame.set})`;
  console.log(`  fps:        prom ${d.fps.avgFps} · mín ${d.fps.minFps} · 1% low ${d.fps.low1} · ${w(d.fps)}`);
  console.log(`  fps CPU 4x: prom ${d.fpsCpu4x.avgFps} · mín ${d.fpsCpu4x.minFps} · 1% low ${d.fpsCpu4x.low1} · ${w(d.fpsCpu4x)}`);
  console.log(`  scroll: total ${d.scroll.totalPx}px (${d.scroll.totalScreens} pantallas) · recorrido 3D ${d.scroll.journeyPx}px (${d.scroll.journeyScreens} pantallas)`);
}
