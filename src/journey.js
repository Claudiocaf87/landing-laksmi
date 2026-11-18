import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Recorte de entrada de la primera foto de cada etapa (todas atadas al scroll).
const REVEAL = {
  circulo: ['circle(0% at 50% 50%)', 'circle(75% at 50% 50%)'],
  diagonal: ['polygon(0% 0%, 0% 0%, -40% 100%, -40% 100%)', 'polygon(0% 0%, 140% 0%, 100% 100%, -40% 100%)'],
};
const STOP_F = [0, 0.05, 0.1, 0.15, 0.2, 0.55, 0.84, 1]; // fracción del mapita en la que cae cada etapa 01 … 08

// Timeline maestra: el scroll de .journey avanza "u" de 0 a N (una unidad por etapa).
// En la misma timeline entran las fotos (pin = capas fijas), los textos, los pasos y los contadores.
// Un solo loop (ticker de GSAP) mueve Lenis, el globo, el mapita y el HUD.
export function createJourney({ stage = null, content, reduced = false }) {
  const root = document.documentElement;
  const journey = document.querySelector('.journey');
  const sections = [...journey.querySelectorAll('.etapa')];
  const N = sections.length;
  const estados = content.hud.estados;
  root.classList.add('is-journey');

  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);

  const proxy = { u: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: journey, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  tl.to(proxy, { u: N, duration: N }, 0);

  const desdeDe = (texto) => estados.find((s) => s.texto === texto)?.desde;

  sections.forEach((sec, i) => {
    // ---------- fotos ----------
    const figs = [...sec.querySelectorAll('.foto')];
    const n = figs.length;
    // cierre: la foto final tiene su momento sola y después se funde para dejar ver el globo
    const closing = sec.hasAttribute('data-cierre');
    figs.forEach((fig, k) => {
      const img = fig.querySelector('img');
      const start = i + k / n; // momento en que esta foto ocupa la pantalla
      const tin = k === 0 ? i - 0.14 : start - 0.08; // entra un poco antes: nunca hay pantalla vacía
      const end = closing ? i + 0.44 : i + 1.14; // la tapa la etapa siguiente (o el globo, en el cierre)
      const type = fig.dataset.transicion;
      tl.set(fig, { visibility: 'visible' }, tin);
      if (reduced) {
        tl.fromTo(fig, { opacity: 0 }, { opacity: 1, duration: 0.12 }, tin);
      } else {
        if (REVEAL[type]) tl.fromTo(fig, { clipPath: REVEAL[type][0] }, { clipPath: REVEAL[type][1], duration: 0.2, ease: 'power2.inOut' }, tin);
        else if (type === 'lateral') tl.fromTo(fig, { opacity: 0, xPercent: 7 }, { opacity: 1, xPercent: 0, duration: 0.2, ease: 'power2.out' }, tin);
        else tl.fromTo(fig, { opacity: 0 }, { opacity: 1, duration: 0.16 }, tin);
        // zoom lento tipo Ken Burns (con un leve desplazamiento lateral alternado)
        tl.fromTo(img, { scale: 1.12, xPercent: k % 2 ? -1.5 : 1.5 }, { scale: 1, xPercent: 0, duration: end - tin }, tin);
      }
      if (closing) tl.to(fig, { opacity: 0, duration: 0.12, ease: 'power1.inOut' }, i + 0.3);
      tl.set(fig, { visibility: 'hidden' }, end + 0.02);
    });

    // ---------- textos ----------
    const inner = sec.querySelector('.etapa__inner');
    const last = i === N - 1;
    // en el cierre, la foto tiene su momento sola: el texto entra con el globo
    const textIn = closing ? i + 0.32 : i + 0.05;
    if (i > 0) tl.fromTo(inner, { autoAlpha: 0, y: reduced ? 0 : 50 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, textIn);
    if (!last) tl.to(inner, { autoAlpha: 0, y: reduced ? 0 : -50, duration: 0.12, ease: 'power2.in' }, i + 0.84);

    // pasos: el texto cambia junto con el estado del HUD
    const pasos = [...sec.querySelectorAll('.pasos li')];
    pasos.forEach((li, k) => {
      if (k === 0) return;
      const at = desdeDe(li.querySelector('strong').textContent) ?? i + k / pasos.length;
      tl.to(pasos[k - 1], { autoAlpha: 0, duration: 0.06 }, at - 0.04);
      tl.fromTo(li, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, at);
    });

    // contadores: solo animan si el valor es un número (los placeholders quedan como texto)
    sec.querySelectorAll('[data-count]').forEach((el, k) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target)) return;
      const o = { v: 0 };
      const at = last ? i + 0.34 : i + 0.1;
      tl.fromTo(o, { v: 0 }, { v: target, duration: 0.25, onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString('es-VE')) }, at + k * 0.03);
    });
  });

  // globo como imagen fija (sin WebGL, saveData o gama baja)
  if (!stage) {
    const hero = document.querySelector('.globo-img[data-cual="hero"]');
    const cierre = document.querySelector('.globo-img[data-cual="cierre"]');
    if (hero) tl.fromTo(hero, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: true }, 1.0);
    if (cierre) tl.fromTo(cierre, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, N - 1 + 0.3);
  }

  // ---------- navegación: cada ancla lleva a la estación de su etapa ----------
  const scrollable = () => journey.offsetHeight - window.innerHeight;
  const scrollForU = (u) => journey.offsetTop + (u / N) * scrollable();
  let navigating = false;
  let measuring = false; // seek() (pruebas y capturas) apaga el imán del hero
  let active = -1;
  const station = (i) => (i === 0 ? 0 : i === N - 1 ? i + 0.7 : i + 0.4);
  const goTo = (target, { immediate = false, u = null } = {}) => {
    const i = sections.findIndex((s) => s.id === target);
    let to;
    if (u != null) to = scrollForU(u);
    else if (i >= 0) to = scrollForU(station(i));
    else {
      const el = document.getElementById(target);
      if (!el) return;
      to = el.getBoundingClientRect().top + window.scrollY;
    }
    const dist = Math.abs(to - window.scrollY) / window.innerHeight;
    // durante el salto no se piden las fotos de las etapas que pasan de largo
    navigating = !(immediate || reduced);
    lenis.scrollTo(to, {
      duration: Math.min(3.2, Math.max(1, dist / 3)),
      immediate: immediate || reduced,
      force: true,
      onComplete: () => {
        navigating = false;
        active = -1; // fuerza la carga de la etapa de destino y la siguiente
      },
    });
  };

  // hero: si el scroll se detiene a mitad del giro del globo, termina de llevarlo al extremo más
  // cercano (China o América). Así nunca queda en reposo mirando solo océano.
  if (stage && !reduced) {
    const end = stage.globe.heroEnd;
    let idle;
    lenis.on('scroll', () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        const u = proxy.u;
        if (navigating || measuring || u <= 0.015 || u >= end - 0.015) return;
        goTo(null, { u: u < end * 0.4 ? 0 : end });
      }, 220);
    });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('nav:go'));
    goTo(id, { u: a.dataset.u ? Number(a.dataset.u) : null });
    history.replaceState(null, '', `#${id}`);
  });
  journey.addEventListener('focusin', (e) => {
    const sec = e.target.closest('.etapa');
    if (sec && Math.floor(proxy.u) !== Number(sec.dataset.etapa)) goTo(sec.id, { immediate: true });
  });

  // ---------- carga de fotos: solo la etapa actual y la siguiente ----------
  const loaded = new Set();
  const loadStage = (i) => {
    if (i < 0 || i >= N || loaded.has(i)) return;
    loaded.add(i);
    sections[i].querySelectorAll('picture').forEach((pic) => {
      if (pic.closest('.globo-img') && stage) return; // con globo 3D no hace falta la imagen
      pic.querySelectorAll('source[data-srcset]').forEach((s) => (s.srcset = s.dataset.srcset));
      const img = pic.querySelector('img[data-src]');
      if (img) img.src = img.dataset.src;
    });
  };

  // ---------- mapita + HUD compacto ----------
  const tracker = document.querySelector('.tracker');
  const route = tracker.querySelector('.tracker__route');
  const done = tracker.querySelector('.tracker__done');
  const ship = tracker.querySelector('.tracker__ship');
  const stops = [...tracker.querySelectorAll('.tracker__stop')];
  const len = route.getTotalLength();
  const pointAt = (f) => route.getPointAtLength(Math.min(1, Math.max(0, f)) * len);
  stops.forEach((c) => {
    const p = pointAt(Number(c.dataset.f));
    c.setAttribute('cx', p.x.toFixed(1));
    c.setAttribute('cy', p.y.toFixed(1));
  });
  const routeFraction = (u) => {
    if (u <= 1) return 0;
    if (u >= 8.5) return 1;
    const j = Math.floor(u); // etapa 1 … 8
    const a = STOP_F[j - 1];
    const b = j < 8 ? STOP_F[j] : 1;
    return a + (b - a) * Math.min(1, (u - j) / (j < 8 ? 1 : 0.5));
  };
  const toggle = tracker.querySelector('.tracker__toggle');
  const panel = tracker.querySelector('.tracker__panel');
  const hudItems = [...panel.querySelectorAll('li')];
  const hudNow = tracker.querySelector('.tracker__now');
  const hudCount = tracker.querySelector('.tracker__count');
  const hudBar = tracker.querySelector('.tracker__bar span');
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? content.ui.cerrarSeguimiento : content.ui.seguimiento);
    if (open) (panel.querySelector('[aria-current]') || panel.querySelector('a'))?.focus();
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !tracker.contains(e.target)) setOpen(false);
  });
  document.addEventListener('nav:go', () => !panel.hidden && setOpen(false));

  const navLinks = [...document.querySelectorAll('.menu__list a')];
  const hint = document.querySelector('.scroll-hint');
  let step = -1;
  let flags = '';

  const tick = (time, deltaMs) => {
    lenis.raf(time * 1000);
    const u = proxy.u;
    if (stage) {
      stage.setTarget(u);
      stage.tick(Math.min(deltaMs, 100) / 1000);
    }

    // estado de seguimiento
    let s = 0;
    for (let k = 0; k < estados.length; k++) if (u >= estados[k].desde) s = k;
    if (s !== step) {
      step = s;
      hudItems.forEach((li, k) => {
        li.classList.toggle('is-done', k < s);
        li.classList.toggle('is-now', k === s);
        const a = li.querySelector('a');
        if (k === s) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      });
      hudNow.textContent = estados[s].texto;
      hudCount.textContent = `${s + 1}/${estados.length}`;
    }
    hudBar.style.transform = `scaleX(${Math.min(1, u / (N - 1)).toFixed(4)})`;

    // mapita: el trazo dorado avanza y se encienden los puntos de etapa
    const f = routeFraction(u);
    done.style.strokeDashoffset = String(1 - f);
    const p = pointAt(f);
    ship.setAttribute('cx', p.x.toFixed(1));
    ship.setAttribute('cy', p.y.toFixed(1));

    const idx = Math.min(N - 1, Math.floor(u));
    if (idx !== active) {
      active = idx;
      sections.forEach((sec, k) => sec.classList.toggle('is-active', k === idx));
      navLinks.forEach((l) => (l.getAttribute('href') === `#${sections[idx].id}` ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
      stops.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.etapa) <= idx));
    }
    if (!navigating) {
      loadStage(idx);
      loadStage(idx + 1);
    }
    const past = u >= N - 0.001 && window.scrollY > journey.offsetTop + journey.offsetHeight - window.innerHeight * 0.98;
    const mapOff = u < 0.92 || u >= N - 1 - 0.02;
    const big = sections[idx]?.dataset.mapa === 'grande' && u - idx > 0.06 && u - idx < 0.86;
    const next = `${past}|${mapOff}|${big}`;
    if (next !== flags) {
      flags = next;
      root.classList.toggle('is-past', past);
      root.classList.toggle('is-map-off', mapOff);
      root.classList.toggle('is-map-big', big);
    }
    hint.style.opacity = u < 0.02 ? '' : '0';
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  loadStage(0);
  loadStage(1);

  ScrollTrigger.refresh();
  const startId = location.hash.slice(1);
  if (startId && document.getElementById(startId)) {
    goTo(startId, { immediate: true });
    ScrollTrigger.update();
    stage?.jump(proxy.u);
  }

  // para medir/probar: lleva el recorrido a un u exacto y dibuja ese fotograma
  const seek = (u) => {
    measuring = true;
    lenis.scrollTo(scrollForU(u), { immediate: true, force: true });
    ScrollTrigger.update();
    tl.scrollTrigger.scroll(scrollForU(u));
    tl.progress(u / N);
    stage?.jump(u);
    gsap.ticker.tick();
  };
  const loadAll = () => sections.forEach((_, k) => loadStage(k));

  return { lenis, tl, proxy, goTo, N, scrollForU, seek, loadAll, station };
}
