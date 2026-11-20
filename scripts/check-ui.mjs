// Prueba de la interfaz sobre el build (npm run build && npm run probar).
// Guarda capturas en docs/capturas/ui-*.
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const shot = (name) => fileURLToPath(new URL(`../docs/capturas/ui-${name}.jpg`, import.meta.url));
mkdirSync(new URL('../docs/capturas/', import.meta.url), { recursive: true });
const server = await preview({ preview: { port: 4180, strictPort: true }, logLevel: 'warn' });
const base = 'http://localhost:4180/';
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--ignore-gpu-blocklist'] });
let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
};
const errors = [];
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function page(opts, q = '?medir=1') {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(base + q);
  await p.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 60000 });
  await p.waitForTimeout(500);
  return { ctx, p };
}
const uNow = (p) => p.evaluate(() => window.__journey.proxy.u);
const loadedStages = (p) =>
  p.evaluate(() => [...document.querySelectorAll('.etapa')].map((s) => [...s.querySelectorAll('.foto img')].some((i) => i.getAttribute('src'))).flatMap((v, i) => (v ? [i] : [])));

// ---------- mobile: menú, anclas, carga de fotos ----------
{
  const { ctx, p } = await page(MOBILE);
  ok(!(await p.isVisible('.header__cta')), 'mobile: el CTA del header se oculta (queda el del contenido)');
  const first = await loadedStages(p);
  ok(first.length === 1 && first[0] === 1, `fotos: al entrar solo se pidió la siguiente etapa (etapas con foto: ${first.join(', ') || 'ninguna'})`);
  await p.click('.menu-btn');
  await p.waitForTimeout(400);
  ok(await p.isVisible('#menu'), 'mobile: el menú abre');
  await p.screenshot({ path: shot('menu-mobile'), type: 'jpeg', quality: 75 });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  ok(await p.isHidden('#menu'), 'mobile: Escape cierra el menú');
  await p.click('.menu-btn');
  await p.waitForTimeout(300);
  await p.click('#menu a[href="#aduana"]');
  await p.waitForTimeout(3800);
  const u = await uNow(p);
  const st7 = await p.evaluate(() => window.__journey.station(7));
  ok(Math.abs(u - st7) < 0.06, `mobile: el ancla "Aduana" lleva a su estación (u=${u.toFixed(2)} de ${st7})`);
  const after = await loadedStages(p);
  ok(after.includes(7) && after.includes(8) && !after.includes(4), `fotos: cargadas la actual y la siguiente, no las intermedias (${after.join(', ')})`);
  await p.screenshot({ path: shot('ancla-aduana-mobile'), type: 'jpeg', quality: 75 });
  await ctx.close();
}

// ---------- desktop: HUD compacto, mapita, formulario, perfiles ----------
{
  const { ctx, p } = await page(DESKTOP);
  ok(await p.evaluate(() => document.documentElement.classList.contains('is-map-off')), 'mapita: oculto mientras se ve el globo del hero');
  await p.click('.tracker__toggle');
  ok((await p.getAttribute('.tracker__toggle', 'aria-expanded')) === 'true' && (await p.isVisible('#tracker-list')), 'HUD: el botón despliega los 11 estados (aria-expanded=true)');
  ok((await p.$$eval('#tracker-list li', (l) => l.length)) === 11, 'HUD: la lista tiene 11 estados');
  await p.keyboard.press('Escape');
  ok((await p.isHidden('#tracker-list')) && (await p.evaluate(() => document.activeElement?.classList.contains('tracker__toggle'))), 'HUD: Escape cierra y devuelve el foco al botón');
  await p.click('.tracker__toggle');
  await p.click('#tracker-list a[href="#calidad"]');
  await p.waitForTimeout(3500);
  let u = await uNow(p);
  const st4 = await p.evaluate(() => window.__journey.station(4));
  ok(Math.abs(u - st4) < 0.06, `HUD: "Calidad verificada" lleva a la etapa 04 (u=${u.toFixed(2)} de ${st4})`);
  ok(await p.isHidden('#tracker-list'), 'HUD: la lista se cierra al elegir un estado');
  await p.click('.tracker__toggle');
  await p.click('#tracker-list a[data-u="5.82"]');
  await p.waitForTimeout(2500);
  u = await uNow(p);
  ok(Math.abs(u - 5.82) < 0.06, `HUD: "Embarcado" lleva al sub-estado (u=${u.toFixed(2)})`);
  const now = (await p.textContent('.tracker__now')).trim();
  ok(now === 'Embarcado', `HUD: la línea compacta muestra el estado actual ("${(await p.textContent('.tracker__count')).trim()} · ${now}")`);
  const lit = await p.$$eval('.tracker__stop.is-on', (l) => l.length);
  ok(lit === 5, `mapita: puntos encendidos hasta la etapa actual (${lit} de 8)`);
  await p.evaluate(() => window.__journey.seek(6.45));
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.documentElement.classList.contains('is-map-big')), 'mapita: en tránsito se agranda y muestra [DÍAS DE TRÁNSITO]');
  await p.screenshot({ path: shot('mapa-transito'), type: 'jpeg', quality: 75 });

  await p.click('.nav a[href="#preguntas"]');
  await p.waitForTimeout(3500);
  ok(await p.evaluate(() => document.documentElement.classList.contains('is-past')), 'desktop: al pasar el recorrido se ocultan tracker y textos fijos');
  await p.click('.profile[data-perfil="emprendedor-quemado"]');
  await p.waitForTimeout(2500);
  const [problema, perfil] = await p.evaluate(() => [document.getElementById('f-problema').value, document.getElementById('f-perfil').value]);
  ok(problema === 'Calidad' && perfil === 'emprendedor-quemado', `perfil: completa "Mayor problema" = ${problema} · perfil = ${perfil}`);
  await p.click('#form-cotizar button[type="submit"]');
  await p.waitForTimeout(300);
  const errs = await p.$$eval('.field__error', (els) => els.filter((e) => e.textContent).length);
  ok(errs >= 5, `formulario: valida los campos obligatorios (${errs} errores)`);
  ok(await p.evaluate(() => document.activeElement?.id === 'f-nombre'), 'formulario: el foco va al primer campo con error');
  await p.fill('#f-nombre', 'Prueba');
  await p.fill('#f-email', 'prueba@ejemplo.com');
  await p.fill('#f-telefono', '+58 000 0000000');
  await p.selectOption('#f-pais', 'Venezuela');
  await p.fill('#f-producto', 'Herramientas eléctricas, 2 contenedores');
  await p.click('#form-cotizar button[type="submit"]');
  await p.waitForTimeout(400);
  ok(/endpoint/i.test(await p.textContent('.form__status')), 'formulario: sin endpoint configurado avisa y ofrece WhatsApp');
  const wa = await p.getAttribute('.form__status a', 'href');
  ok(wa?.startsWith('https://wa.me/584228368275?text='), 'formulario: el enlace de WhatsApp lleva el mensaje prearmado con los datos');
  await ctx.close();
}

// ---------- títulos: ninguno recorta su texto (descendentes g, j, p, q, y y acentos) ----------
// Compara las cajas de línea del texto (área de las letras) con el área donde se pinta:
// la caja del propio elemento si usa background-clip: text, y cualquier ancestro con overflow.
const titleClip = (p) =>
  p.evaluate(() => {
    const bad = [];
    const els = [...document.querySelectorAll('.etapa__title span, .block__title, .block__title--xl span')];
    for (const el of els) {
      const box = el.getBoundingClientRect();
      if (!box.width) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const clips = [];
      const cs = getComputedStyle(el);
      if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') clips.push(box);
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (c.overflowY !== 'visible' || c.clipPath !== 'none') clips.push(a.getBoundingClientRect());
      }
      const cut = [...range.getClientRects()].some((t) => clips.some((b) => t.top < b.top - 0.5 || t.bottom > b.bottom + 0.5));
      if (cut) bad.push(el.textContent.trim().slice(0, 32));
    }
    return { count: els.length, bad: [...new Set(bad)] };
  });
for (const [name, opts] of [
  ['desktop', DESKTOP],
  ['mobile', MOBILE],
]) {
  const { ctx, p } = await page(opts);
  const N = await p.evaluate(() => window.__journey.N);
  let worst = { count: 0, bad: [] };
  for (let i = 0; i < N; i++) {
    for (const u of [i + 0.08, await p.evaluate((i) => window.__journey.station(i), i)]) {
      await p.evaluate((u) => window.__journey.seek(u), u);
      const r = await titleClip(p);
      worst = { count: r.count, bad: [...new Set([...worst.bad, ...r.bad])] };
    }
  }
  ok(worst.bad.length === 0, `títulos ${name}: ninguno recorta su texto, también durante la entrada (${worst.count} títulos${worst.bad.length ? ' · cortados: ' + worst.bad.join(' | ') : ''})`);
  await ctx.close();
}

// ---------- globo: no se superpone al texto ----------
for (const [w, h] of [
  [1920, 1080],
  [1440, 900],
  [1280, 720],
  [1024, 768],
]) {
  const { ctx, p } = await page({ viewport: { width: w, height: h } });
  for (const u of [0.3, 9.7]) {
    await p.evaluate((u) => window.__journey.seek(u), u);
    await p.waitForTimeout(300);
    const r = await p.evaluate((u) => {
      const s = window.__stage;
      const g = s.scene.children[0];
      const spin = g.children[0];
      const c = g.getWorldPosition(new s.camera.position.constructor());
      const d = c.distanceTo(s.camera.position);
      const R = 10 * spin.scale.x;
      const v = c.clone().project(s.camera);
      const cx = ((v.x + 1) / 2) * innerWidth;
      const rpx = (Math.tan(Math.asin(R / d)) / Math.tan((s.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
      const inner = document.querySelectorAll('.etapa__inner')[Math.floor(u)].getBoundingClientRect();
      return { left: cx - rpx, right: cx + rpx, textRight: inner.right };
    }, u);
    ok(r.left >= r.textRight - 1 && r.right <= w, `globo ${w}×${h} u=${u}: ${Math.round(r.left)}–${Math.round(r.right)} px · texto hasta ${Math.round(r.textRight)}`);
  }
  await ctx.close();
}

// ---------- modos alternativos ----------
{
  const { ctx, p } = await page(DESKTOP, '?modo=estatico');
  const st = await p.evaluate(() => ({
    static: document.documentElement.classList.contains('is-static'),
    pos: getComputedStyle(document.querySelector('.foto')).position,
    imgs: [...document.querySelectorAll('.foto img')].filter((i) => i.getAttribute('src')).length,
    globe: getComputedStyle(document.querySelector('.globo-img')).display,
  }));
  ok(st.static && st.pos === 'static' && st.imgs >= 13 && st.globe === 'block', `estático: fotos y textos apilados, sin pin (${st.imgs} fotos, globo como imagen)`);
  await p.screenshot({ path: shot('estatico'), type: 'jpeg', quality: 75, fullPage: false });
  await ctx.close();
}
{
  const { ctx, p } = await page(DESKTOP, '?medir=1&modo=liviano');
  const r = await p.evaluate(() => ({ noGlobe: document.documentElement.classList.contains('no-globe'), stage: Boolean(window.__stage), vis: getComputedStyle(document.querySelector('.globo-img[data-cual="hero"]')).visibility }));
  ok(r.noGlobe && !r.stage && r.vis === 'visible', 'gama baja: no carga Three.js y muestra el globo como imagen fija');
  await p.screenshot({ path: shot('globo-imagen'), type: 'jpeg', quality: 75 });
  await ctx.close();
}
{
  const { ctx, p } = await page({ ...DESKTOP, reducedMotion: 'reduce' });
  await p.evaluate(() => window.__journey.seek(2.4));
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const fig = document.querySelector('.foto[data-etapa="2"]');
    return { t: getComputedStyle(fig.querySelector('img')).transform, clip: getComputedStyle(fig).clipPath, op: getComputedStyle(fig).opacity };
  });
  ok(r.t === 'none' && r.clip === 'none' && r.op === '1', `reduced motion: solo fundidos, sin zoom ni recortes (transform=${r.t}, clip=${r.clip})`);
  await p.evaluate(() => window.__journey.seek(6.4));
  await p.waitForTimeout(1500);
  const v = await p.evaluate(() => ({ activo: window.__clips.activo, pedidos: window.__clips.clips.filter((c) => c.state !== 'idle').length, conVideo: document.querySelectorAll('.has-video').length }));
  ok(!v.activo && v.pedidos === 0 && v.conVideo === 0, 'reduced motion: sin clips, queda la foto (póster)');
  ok(!(await p.evaluate(() => document.querySelector('.grano'))), 'reduced motion: sin grano');
  await ctx.close();
}

// ---------- modo video ----------
{
  const { ctx, p } = await page(DESKTOP);
  const videos = [];
  p.on('request', (r) => /\/video\//.test(r.url()) && videos.push(r.url().split('/').pop()));
  ok(videos.length === 0, `video: en el hero no se pide ningún clip (${videos.join(', ') || 'ninguno'})`);
  await p.evaluate(() => window.__journey.seek(0.5));
  await p.waitForFunction(() => window.__clips.clips.find((c) => c.id === 'plan').state === 'ready', null, { timeout: 15000 });
  ok(videos[0] === 'plan-desktop.av1.mp4' && !videos.some((v) => /^(negociacion|calidad|carga|puerto)/.test(v)), `video: al empezar a scrollear se pide el clip de la etapa siguiente, en AV1 (${videos.join(', ')})`);
  // foto nítida en reposo: en la estación de la etapa 01 el clip está en su primer cuadro y se ve la foto
  await p.evaluate(() => window.__journey.seek(window.__journey.station(1)));
  await p.waitForTimeout(700);
  const rep = await p.evaluate(() => {
    const c = window.__clips.clips.find((x) => x.id === 'plan');
    return { reposo: c.fig.classList.contains('en-reposo'), op: getComputedStyle(c.video).opacity };
  });
  await p.evaluate(() => window.__journey.seek(1.6));
  await p.waitForTimeout(700);
  const mov = await p.evaluate(() => {
    const c = window.__clips.clips.find((x) => x.id === 'plan');
    return { reposo: c.fig.classList.contains('en-reposo'), op: getComputedStyle(c.video).opacity, t: c.video.currentTime };
  });
  ok(rep.reposo && rep.op === '0' && !mov.reposo && mov.op === '1' && mov.t > 0.5, `foto nítida: en la estación se ve la foto y al avanzar el video (${JSON.stringify(rep)} → ${JSON.stringify(mov)})`);
  ok(await p.evaluate(() => Boolean(document.querySelector('.journey .grano'))), 'grano: capa fina sobre fotos y clips');
  await p.evaluate(() => window.__journey.seek(2.25));
  await p.waitForFunction(() => window.__clips.clips.find((c) => c.id === 'feria').state === 'ready', null, { timeout: 15000 });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const c = window.__clips.clips.find((x) => x.id === 'feria');
    return { on: c.fig.classList.contains('has-video'), diff: Math.abs(c.video.currentTime - c.p * c.video.duration) * 24, p: c.p };
  });
  ok(r.on && r.diff <= 1, `video: el clip reemplaza al póster en el cuadro que marca el scroll (p=${r.p.toFixed(2)}, desfase ${r.diff.toFixed(2)} cuadros)`);
  const rail = await p.evaluate(() => document.querySelectorAll('.viaje__dot.is-on').length);
  ok(rail === 2, `línea del viaje: puntos encendidos hasta la etapa actual (${rail} de 9)`);
  const before = videos.length;
  await p.click('.menu-btn');
  await p.waitForTimeout(300);
  await p.click('#menu a[href="#transito"]');
  await p.waitForTimeout(3800);
  const nuevos = videos.slice(before);
  ok(nuevos[0]?.startsWith('transito') && !nuevos.some((n) => /^(negociacion|calidad|carga|puerto)/.test(n)), `video: al saltar por el menú se pide primero el destino y ninguna etapa intermedia (${nuevos.join(', ')})`);
  await p.screenshot({ path: shot('video-transito'), type: 'jpeg', quality: 75 });
  await ctx.close();
}
{
  const { ctx, p } = await page(MOBILE);
  await p.evaluate(() => window.__journey.seek(5.4));
  await p.waitForFunction(() => window.__clips.clips.find((c) => c.id === 'puerto').state === 'ready', null, { timeout: 15000 });
  const u = await p.evaluate(() => window.__clips.clips.find((c) => c.id === 'puerto').url);
  ok(/puerto-mobile\.(av1\.)?mp4$/.test(u), `video mobile: usa la versión vertical (${u})`);
  await p.evaluate(() => window.__journey.seek(5.9));
  await p.waitForTimeout(900);
  await p.screenshot({ path: shot('video-puerto-mobile'), type: 'jpeg', quality: 75 });
  const rail = await p.evaluate(() => {
    const a = document.querySelector('.viaje').getBoundingClientRect();
    const b = document.querySelector('.tracker').getBoundingClientRect();
    const t = document.querySelector('#despacho .etapa__inner').getBoundingClientRect();
    return { arriba: b.top - a.bottom, texto: a.top - t.bottom };
  });
  ok(rail.arriba >= 0 && rail.texto >= 0, `línea del viaje mobile: entre el texto y el HUD sin taparlos (${rail.texto.toFixed(0)} px / ${rail.arriba.toFixed(0)} px)`);
  await ctx.close();
}
{
  const { ctx, p } = await page(DESKTOP, '?medir=1&modo=sin-video');
  await p.evaluate(() => window.__journey.seek(2.3));
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ pedidos: window.__clips.clips.filter((c) => c.state !== 'idle').length, img: document.querySelector('#ferias .foto--clip img').complete }));
  ok(r.pedidos === 0 && r.img, 'sin video (ahorro de datos, 2g/3g, gama baja): queda la foto con su desplazamiento');
  await ctx.close();
}

ok(errors.length === 0, `sin errores de consola${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `\n${fails} pruebas fallidas` : '\nTodas las pruebas pasan');
await browser.close();
await server.close();
