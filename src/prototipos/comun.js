import '../styles/main.css';
import './prototipos.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { content } from '../content/index.js';
import { etapaInner, picture } from '../content/render.js';
import { createTracker } from '../ui/tracker.js';
import { initMenu } from '../ui/menu.js';

gsap.registerPlugin(ScrollTrigger);
export { gsap, content, picture };

// Base común de los tres prototipos de "sensación de avance".
// Cada versión arma su escena y recibe el progreso del tramo (0 … 1) en cada fotograma.
const params = new URLSearchParams(location.search);
const conn = navigator.connection || {};
export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('modo') === 'cortes';
export const saveData = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
export const lowEnd = params.get('modo') === 'liviano' || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
export const portrait = () => window.innerHeight > window.innerWidth;
export const N_GLOBAL = content.etapas.length;
export const etapa = (id) => {
  const i = content.etapas.findIndex((e) => e.id === id);
  return { e: content.etapas[i], i };
};
document.documentElement.classList.toggle('is-reduced', reduced);

// los enlaces del header apuntan al recorrido completo
document.querySelectorAll('.header a[href^="#"], #menu a[href^="#"]').forEach((a) => (a.href = `/${a.getAttribute('href')}`));
initMenu({ labels: content.ui });

// barra para saltar entre versiones
export function versionBar(current) {
  const p = content.prototipos;
  const nav = document.createElement('nav');
  nav.className = 'proto-bar';
  nav.setAttribute('aria-label', p.titulo);
  nav.innerHTML = p.versiones.map((v) => `<a href="${v.href}"${v.id === current ? ' aria-current="page"' : ''}>${v.nombre}</a>`).join('');
  document.body.append(nav);
}

// bloque de texto de una etapa (el mismo del recorrido principal)
export function textBlock(id) {
  const { e, i } = etapa(id);
  const div = document.createElement('div');
  div.className = 'proto-text';
  div.dataset.etapa = i;
  div.innerHTML = etapaInner(e, i, content, { panel: true, h: 'h2' });
  return div;
}

// pasos (p. ej. "Condiciones negociadas" → "Proveedor verificado"): cambian con el estado del HUD
export function syncPasos(root, uGlobal) {
  root.querySelectorAll('.pasos').forEach((ol) => {
    const items = [...ol.children];
    let k = 0;
    items.forEach((li, j) => {
      const desde = content.hud.estados.find((s) => s.texto === li.querySelector('strong').textContent)?.desde;
      if (desde != null && uGlobal >= desde) k = j;
    });
    items.forEach((li, j) => li.classList.toggle('is-on', j === k));
  });
}

// carga una foto ya (los prototipos son tramos cortos)
export function loadPicture(scope) {
  scope.querySelectorAll('source[data-srcset]').forEach((s) => (s.srcset = s.dataset.srcset));
  scope.querySelectorAll('img[data-src]').forEach((img) => (img.src = img.dataset.src));
}

// interpola el u global del recorrido a partir de una posición local (lista de puntos [pos, u])
export function mapU(pos, points) {
  if (pos <= points[0][0]) return points[0][1];
  for (let k = 0; k < points.length - 1; k++) {
    const [a, ua] = points[k];
    const [b, ub] = points[k + 1];
    if (pos <= b) return ua + ((pos - a) / (b - a)) * (ub - ua);
  }
  return points[points.length - 1][1];
}

// Scroll suave + progreso del tramo. section: el elemento alto que define el recorrido.
// onFrame(p, info) se llama en cada fotograma con p = 0 … 1 y la velocidad del scroll.
export function setupScroll(section, onFrame) {
  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);
  const state = { p: 0 };
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (st) => (state.p = st.progress),
  });
  const tracker = createTracker(content);
  gsap.ticker.add((time, dt) => {
    lenis.raf(time * 1000);
    onFrame(state.p, { velocity: lenis.velocity, dt: Math.min(dt, 100) / 1000, tracker });
  });
  gsap.ticker.lagSmoothing(0);
  const scrollForP = (p) => section.offsetTop + p * (section.offsetHeight - window.innerHeight);
  // para medir: lleva el tramo a un progreso exacto
  window.__proto = {
    lenis,
    scrollForP,
    progress: () => state.p,
    seek(p) {
      lenis.scrollTo(scrollForP(p), { immediate: true, force: true });
      ScrollTrigger.update();
      gsap.ticker.tick();
    },
  };
  ScrollTrigger.refresh();
  return { lenis, state, tracker, scrollForP };
}

// cierre del tramo: links a las otras versiones y al recorrido completo
export function endBlock(current) {
  const p = content.prototipos;
  const sec = document.createElement('section');
  sec.className = 'proto-end';
  sec.innerHTML = `<p class="kicker kicker--dark">${p.titulo}</p><h2 class="block__title">${p.fin}</h2>
    <ul>${p.versiones
      .filter((v) => v.id !== current)
      .map((v) => `<li><a class="btn btn--ghost" href="${v.href}">${v.nombre}</a></li>`)
      .join('')}<li><a class="btn btn--solid" href="/">${p.volver}</a></li></ul>`;
  return sec;
}
