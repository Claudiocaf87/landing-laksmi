import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Timeline maestra: el scroll de .journey avanza "u" de 0 a N (una unidad por etapa).
// En la misma timeline entran y salen los textos, corren los contadores y avanza el minimapa.
// Un solo loop (ticker de GSAP) mueve Lenis, la escena 3D y el HUD.
export function createJourney(stage, content) {
  const root = document.documentElement;
  const journey = document.querySelector('.journey');
  const sections = [...journey.querySelectorAll('.etapa')];
  const N = sections.length;
  const estados = content.hud.estados;
  root.classList.add('is-journey'); // activa el layout del recorrido antes de medir

  // --- scroll suave ---
  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);

  // --- timeline maestra ---
  const proxy = { u: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: journey, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  tl.to(proxy, { u: N, duration: N }, 0);

  sections.forEach((sec, i) => {
    const inner = sec.querySelector('.etapa__inner');
    const last = i === N - 1;
    if (i > 0) tl.fromTo(inner, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.14, ease: 'power2.out' }, i + 0.04);
    if (!last) tl.to(inner, { autoAlpha: 0, y: -70, duration: 0.14, ease: 'power2.in' }, i + 0.78);

    // contadores: solo animan si el valor es un número (los placeholders quedan como texto)
    sec.querySelectorAll('[data-count]').forEach((el, k) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target)) return;
      const o = { v: 0 };
      tl.fromTo(o, { v: 0 }, { v: target, duration: 0.3, onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString('es-VE')) }, i + 0.08 + k * 0.03);
    });
  });

  // minimapa de la etapa 05: el barco recorre la ruta
  const route = document.querySelector('.minimap__done');
  const shipDot = document.querySelector('.minimap__ship');
  const path = document.querySelector('.minimap__route');
  const mapIdx = sections.findIndex((s) => s.querySelector('.minimap'));
  if (route && path && mapIdx >= 0) {
    const len = path.getTotalLength();
    const m = { p: 0 };
    const draw = () => {
      route.style.strokeDashoffset = String(1 - m.p);
      const pt = path.getPointAtLength(m.p * len);
      shipDot.setAttribute('cx', pt.x.toFixed(1));
      shipDot.setAttribute('cy', pt.y.toFixed(1));
    };
    tl.fromTo(m, { p: 0 }, { p: 1, duration: 0.9, onUpdate: draw }, mapIdx + 0.05);
    draw();
  }

  // --- navegación: cada ancla lleva la cámara a la estación de su etapa ---
  const scrollable = () => journey.offsetHeight - window.innerHeight;
  const scrollForU = (u) => journey.offsetTop + (u / N) * scrollable();
  const goTo = (target, { immediate = false, u = null } = {}) => {
    const i = sections.findIndex((s) => s.id === target);
    let to;
    if (u != null) to = scrollForU(u);
    else if (i >= 0) to = scrollForU(i === 0 ? 0 : i + 0.5);
    else {
      const el = document.getElementById(target);
      if (!el) return;
      to = el.getBoundingClientRect().top + window.scrollY;
    }
    const dist = Math.abs(to - window.scrollY) / window.innerHeight;
    lenis.scrollTo(to, { duration: Math.min(3.2, Math.max(1, dist / 3)), immediate: immediate || stage.snap, force: true });
  };

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

  // con teclado: si el foco entra en una etapa, la cámara va hasta ahí
  journey.addEventListener('focusin', (e) => {
    const sec = e.target.closest('.etapa');
    if (sec && Math.floor(proxy.u) !== Number(sec.dataset.etapa)) goTo(sec.id, { immediate: true });
  });

  // --- HUD ---
  const hud = document.querySelector('.hud');
  const hudItems = [...hud.querySelectorAll('.hud__list li')];
  const hudNow = hud.querySelector('.hud__now');
  const hudCount = hud.querySelector('.hud__count');
  const hudBar = hud.querySelector('.hud__bar span');
  const hint = document.querySelector('.scroll-hint');
  const navLinks = [...document.querySelectorAll('.menu__list a')];
  let step = -1;
  let active = -1;
  let past = null;

  const tick = (time, deltaMs) => {
    lenis.raf(time * 1000);
    stage.setTarget(proxy.u);
    stage.tick(Math.min(deltaMs, 100) / 1000, N);
    const u = stage.u;

    // estado de seguimiento
    let s = 0;
    for (let i = 0; i < estados.length; i++) if (u >= estados[i].desde) s = i;
    if (s !== step) {
      step = s;
      hudItems.forEach((li, i) => {
        li.classList.toggle('is-done', i < s);
        li.classList.toggle('is-now', i === s);
        const a = li.querySelector('a');
        if (i === s) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      });
      hudNow.textContent = estados[s].texto;
      hudCount.textContent = `${s + 1}/${estados.length}`;
    }
    hudBar.style.transform = `scaleX(${Math.min(1, u / N).toFixed(4)})`;

    // etapa activa (para pointer-events y el menú)
    const idx = Math.min(N - 1, Math.floor(proxy.u));
    if (idx !== active) {
      active = idx;
      sections.forEach((sec, i) => sec.classList.toggle('is-active', i === idx));
      navLinks.forEach((l) => (l.getAttribute('href') === `#${sections[idx].id}` ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
    }
    const isPast = proxy.u >= N - 0.001 && window.scrollY > journey.offsetTop + journey.offsetHeight - window.innerHeight * 0.98;
    if (isPast !== past) {
      past = isPast;
      root.classList.toggle('is-past', isPast);
    }
    hint.style.opacity = proxy.u < 0.02 ? '' : '0';
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.refresh();
  const startId = location.hash.slice(1);
  if (startId && document.getElementById(startId)) {
    goTo(startId, { immediate: true });
    ScrollTrigger.update();
    stage.jump(proxy.u);
  }

  // para medir/probar: lleva el recorrido a un u exacto y dibuja ese fotograma
  const seek = (u) => {
    lenis.scrollTo(scrollForU(u), { immediate: true, force: true });
    ScrollTrigger.update();
    tl.scrollTrigger.scroll(scrollForU(u));
    tl.progress(u / N);
    stage.jump(u);
    gsap.ticker.tick();
  };

  return { lenis, tl, proxy, goTo, N, scrollForU, seek };
}
