// Prueba rápida de la interfaz sobre el build (npm run build && node scripts/check-ui.mjs):
// menú (abre, Escape cierra, ancla lleva a la etapa), HUD clicable, validación del formulario,
// selector de perfil, modo estático y modo "cortes" (reduced motion). Guarda capturas en docs/capturas/ui-*.
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
const ok = (cond, msg) => console.log(`${cond ? '✔' : '✘'} ${msg}`);
const errors = [];

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

// ---------- mobile: menú ----------
{
  const { ctx, p } = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  ok(!(await p.isVisible('.header__cta')), 'mobile: el CTA del header se oculta (queda el del contenido)');
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
  const u = await p.evaluate(() => window.__stage.u);
  ok(Math.abs(u - 6.5) < 0.08, `mobile: el ancla "Aduana" lleva la cámara a su estación (u=${u.toFixed(2)})`);
  await p.screenshot({ path: shot('ancla-aduana-mobile'), type: 'jpeg', quality: 75 });
  await ctx.close();
}

// ---------- desktop: HUD, formulario, perfiles ----------
{
  const { ctx, p } = await page({ viewport: { width: 1440, height: 900 } });
  await p.click('.hud a[href="#calidad"]');
  await p.waitForTimeout(3500);
  const u = await p.evaluate(() => window.__stage.u);
  ok(Math.abs(u - 3.5) < 0.08, `desktop: el HUD "Calidad verificada" lleva a la estación 03 (u=${u.toFixed(2)})`);
  await p.click('.hud a[data-u]');
  await p.waitForTimeout(2500);
  const u2 = await p.evaluate(() => window.__stage.u);
  ok(Math.abs(u2 - 4.8) < 0.08, `desktop: el HUD "Embarcado" lleva al sub-estado (u=${u2.toFixed(2)})`);
  const now = await p.textContent('.hud__list .is-now');
  ok(now.trim() === 'Embarcado', `desktop: el HUD marca el estado actual ("${now.trim()}")`);

  await p.click('.nav a[href="#preguntas"]');
  await p.waitForTimeout(3500);
  ok(await p.evaluate(() => document.documentElement.classList.contains('is-past')), 'desktop: al pasar el 3D se ocultan HUD y textos fijos');
  await p.click('#preguntas summary');
  await p.screenshot({ path: shot('faq'), type: 'jpeg', quality: 75 });

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
  const status = await p.textContent('.form__status');
  ok(/endpoint/i.test(status), 'formulario: sin endpoint configurado avisa y ofrece WhatsApp');
  const wa = await p.getAttribute('.form__status a', 'href');
  ok(wa?.startsWith('https://wa.me/584228368275?text='), 'formulario: el enlace de WhatsApp lleva el mensaje prearmado con los datos');
  await p.screenshot({ path: shot('formulario'), type: 'jpeg', quality: 75 });
  await ctx.close();
}

// ---------- modos alternativos ----------
{
  const { ctx, p } = await page({ viewport: { width: 1440, height: 900 } }, '?modo=estatico');
  ok(await p.evaluate(() => document.documentElement.classList.contains('is-static')), 'estático: ?modo=estatico usa la versión sin 3D');
  await p.screenshot({ path: shot('estatico'), type: 'jpeg', quality: 75 });
  await ctx.close();
}
{
  const { ctx, p } = await page({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await p.evaluate(() => window.scrollTo(0, window.__journey.scrollForU(2.2)));
  await p.waitForTimeout(800);
  const u = await p.evaluate(() => window.__stage.u);
  ok(Math.abs(u - 2.5) < 1e-3, `reduced motion: la cámara salta a la estación sin volar (u=${u})`);
  await ctx.close();
}

ok(errors.length === 0, `sin errores de consola${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
await server.close();
