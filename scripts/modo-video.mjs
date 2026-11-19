// Material del modo video (npm run build && node scripts/modo-video.mjs):
//   · docs/videos/recorrido-{desktop,mobile}.webm  → recorrido completo a ritmo de lectura (6 s por etapa)
//   · docs/videos/feria-{10s,5s}.webm               → la etapa de ferias con cada variante del clip
//   · docs/videos/4g-lento-{desktop,mobile}.webm    → el recorrido con la red "Slow 4G" de Chrome
//   · docs/medicion-video.json                      → bytes por tipo, cuadros sin imagen, saltos al pasar a video
// SOLO=recorrido,feria,4g para correr una parte.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const file = (rel) => fileURLToPath(new URL(`../docs/${rel}`, import.meta.url));
mkdirSync(file('videos/'), { recursive: true });
const SOLO = (process.env.SOLO || 'recorrido,feria,4g').split(',');
const VP = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
// "Slow 4G" de las DevTools de Chrome: 1,6 Mbps de bajada, 750 kbps de subida, 150 ms de RTT
// (con los mismos factores que aplica Chrome: ×0,9 de ancho de banda y ×3,75 de latencia)
const SLOW_4G = { offline: false, latency: 150 * 3.75, downloadThroughput: (1.6 * 1e6 * 0.9) / 8, uploadThroughput: (750 * 1e3 * 0.9) / 8 };
const PORT = 4186;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const result = {};

async function open(name, { query = '', record = false, net = null, cpu = 1 } = {}) {
  const opts = { ...VP[name] };
  if (record) opts.recordVideo = { dir: file('videos/'), size: name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 } };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.__born = Date.now(); // la grabación empieza con la página
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (net) await cdp.send('Network.emulateNetworkConditions', net);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const bytes = {};
  const urls = {};
  cdp.on('Network.responseReceived', (e) => (urls[e.requestId] = e.response.url));
  cdp.on('Network.loadingFinished', (e) => {
    const u = urls[e.requestId] || '';
    const k = /\/video\//.test(u) ? 'video' : /\/fotos\/|\.(webp|avif|jpg|png)/.test(u) ? 'fotos' : /\.js/.test(u) ? 'js' : /\.css/.test(u) ? 'css' : /\.(woff2?|ttf)/.test(u) ? 'fuentes' : 'otros';
    bytes[k] = (bytes[k] || 0) + e.encodedDataLength;
  });
  page.on('pageerror', (e) => console.log('  [error]', e.message));
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/${query ? query + '&' : '?'}medir=1`);
  await page.waitForFunction(() => window.__journey && !document.querySelector('.loader'), null, { timeout: 120000 });
  return { ctx, page, cdp, bytes, loadMs: Date.now() - t0 };
}

// Recorre de u0 a u1 a velocidad constante (s segundos por etapa) y revisa cada cuadro:
//   · vacía: ninguna foto/clip visible con imagen cargada cubriendo la pantalla (fuera del hero y el cierre)
//   · salto: el clip reemplaza al póster en un cuadro distinto del que corresponde al scroll
const run = (page, u0, u1, perStage) =>
  page.evaluate(
    async ({ u0, u1, perStage }) => {
      const j = window.__journey;
      const from = j.scrollForU(u0);
      const to = j.scrollForU(u1);
      const dur = (u1 - u0) * perStage * 1000;
      const log = { frames: 0, vacias: [], saltos: [], clips: {} };
      const seen = new Set();
      const shown = (img) => img && img.complete && img.naturalWidth > 0;
      await new Promise((resolve) => {
        let start = null;
        const f = (now) => {
          start ??= now;
          const t = Math.min(1, (now - start) / dur);
          j.lenis.scrollTo(from + t * (to - from), { immediate: true, force: true });
          const u = j.proxy.u;
          log.frames++;
          if (u > 1.0 && u < j.N - 1 + 0.25) {
            const vis = [...document.querySelectorAll('.foto')].filter((f) => f.style.visibility === 'visible' && parseFloat(getComputedStyle(f).getPropertyValue('--w') || '100') > 50);
            const top = vis[vis.length - 1];
            const ok = top && (shown(top.querySelector('img')) || top.classList.contains('has-video'));
            if (!ok) log.vacias.push(+u.toFixed(3));
          }
          for (const it of window.__clips.clips) {
            log.clips[it.id] = { ...log.clips[it.id], estado: it.state, motivo: it.why || null, kb: +(it.bytes / 1024).toFixed(0), cargaMs: it.loadMs ?? null };
            if (it.fig.classList.contains('has-video') && !seen.has(it.id)) {
              seen.add(it.id);
              // desfase entre el cuadro dibujado y el que pide el scroll en el momento del fundido
              const diff = (it.shownAt?.desfase ?? 0) * 24; // en cuadros
              const fade = parseFloat(getComputedStyle(it.video).transitionDuration) || 0;
              log.clips[it.id].entraEnU = +u.toFixed(3);
              log.clips[it.id].desfaseCuadros = +diff.toFixed(1);
              log.clips[it.id].fundidoS = fade;
              // salto = cambio instantáneo (sin fundido) o un cuadro a más de ¼ s del que marca el scroll
              if (fade < 0.3 || diff > 6) log.saltos.push({ id: it.id, u: +u.toFixed(3), cuadros: +diff.toFixed(1), fundidoS: fade });
            }
          }
          if (t < 1) requestAnimationFrame(f);
          else resolve();
        };
        requestAnimationFrame(f);
      });
      log.lento = window.__clips.lento;
      return log;
    },
    { u0, u1, perStage },
  );

const kb = (bytes) => Object.fromEntries(Object.entries(bytes).map(([k, b]) => [k, +(b / 1024).toFixed(1)]));
const total = (bytes) => +(Object.values(bytes).reduce((a, b) => a + b, 0) / 1024).toFixed(1);
// guarda la grabación; con desde (ms de Date.now) recorta lo anterior (el loader)
async function save(page, ctx, name, desde = null) {
  const path = await page.video().path();
  await ctx.close();
  const out = file(`videos/${name}.webm`);
  if (desde == null) return renameSync(path, out);
  const ss = Math.max(0, (desde - page.__born) / 1000 - 0.3).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', ss, '-i', path, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-an', out]);
  unlinkSync(path);
}

for (const name of ['desktop', 'mobile']) {
  if (SOLO.includes('recorrido')) {
    const { ctx, page, bytes, loadMs } = await open(name, { record: true });
    const desde = Date.now();
    await page.waitForTimeout(1500);
    const log = await run(page, 0, 10, 6);
    await page.waitForTimeout(1000);
    result[`recorrido-${name}`] = { cargaMs: loadMs, kb: kb(bytes), totalKB: total(bytes), cuadros: log.frames, vacias: log.vacias.length, saltos: log.saltos, clips: log.clips };
    console.log(`recorrido ${name}: ${total(bytes)} KB ${JSON.stringify(kb(bytes))} · vacías ${log.vacias.length} · saltos ${log.saltos.length}`, JSON.stringify(log.clips));
    await save(page, ctx, `recorrido-${name}`, desde);
  }
  // 4g: el perfil "Slow 4G" tal cual (Chrome lo informa como effectiveType 3g → sin clips)
  // 4g-ect: el mismo ancho de banda con 150 ms de RTT, que Chrome informa como 4g → se intentan los clips
  for (const [tag, net] of [
    ['4g-lento', SLOW_4G],
    ['4g-lento-ect4g', { ...SLOW_4G, latency: 150 }],
  ]) {
    if (!SOLO.includes('4g')) break;
    const { ctx, page, bytes, loadMs } = await open(name, { record: true, net, cpu: name === 'mobile' ? 4 : 1 });
    const ect = await page.evaluate(() => navigator.connection?.effectiveType);
    await page.waitForTimeout(1500);
    const log = await run(page, 0, 10, 6);
    await page.waitForTimeout(1000);
    result[`${tag}-${name}`] = { ect, cargaMs: loadMs, kb: kb(bytes), totalKB: total(bytes), cuadros: log.frames, vacias: log.vacias, saltos: log.saltos, clips: log.clips, sinMasVideo: log.lento };
    console.log(`${tag} ${name} (ect ${ect}): carga ${loadMs} ms · ${total(bytes)} KB · vacías ${log.vacias.length} · saltos ${log.saltos.length} · sin más video ${log.lento}`, JSON.stringify(log.clips));
    await save(page, ctx, `${tag}-${name}`);
  }
}
if (SOLO.includes('feria')) {
  for (const [tag, q] of [
    ['10s', ''],
    ['5s', '?clip-feria=feria-5s'],
  ]) {
    for (const name of ['desktop', 'mobile']) {
      const { ctx, page } = await open(name, { record: true, query: q });
      await page.evaluate(() => window.__journey.seek(1.85));
      await page.waitForFunction(() => window.__clips.clips[0].state === 'ready', null, { timeout: 20000 }).catch(async () => console.log('  no listo', tag, name, await page.evaluate(() => JSON.stringify(window.__clips.clips.map((c) => [c.id, c.state, c.why])))));
      await page.waitForTimeout(600);
      const desde = Date.now();
      await run(page, 1.85, 2.62, 6);
      await page.waitForTimeout(700);
      await save(page, ctx, `feria-${tag}-${name}`, desde);
    }
  }
}
writeFileSync(file('medicion-video.json'), JSON.stringify(result, null, 2));
await browser.close();
await server.close();
