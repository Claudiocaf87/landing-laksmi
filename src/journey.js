import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createTracker } from './ui/tracker.js';
import { createClips } from './ui/clips.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const HOLD = 0.2; // parte de la etapa en que un clip con foto nítida queda en su primer cuadro

// Cada foto (o clip) entra con un barrido de izquierda a derecha, en la dirección del viaje, con un
// filo dorado; después se desplaza despacio hacia la derecha (la "cámara" sigue viajando).

// Timeline maestra: el scroll de .journey avanza "u" de 0 a N (una unidad por etapa).
// En la misma timeline entran las fotos (pin = capas fijas), los textos, los pasos y los contadores.
// Un solo loop (ticker de GSAP) mueve Lenis, el globo, el mapita y el HUD.
export function createJourney({ stage = null, content, reduced = false, video = false }) {
  const root = document.documentElement;
  const journey = document.querySelector('.journey');
  const sections = [...journey.querySelectorAll('.etapa')];
  const N = sections.length;
  const estados = content.hud.estados;
  root.classList.add('is-journey');
  root.classList.toggle('is-barrido', !reduced);

  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);

  const proxy = { u: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: journey, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  tl.to(proxy, { u: N, duration: N }, 0);

  const desdeDe = (texto) => estados.find((s) => s.texto === texto)?.desde;

  const holds = [];
  sections.forEach((sec, i) => {
    // ---------- fotos y clips ----------
    const figs = [...sec.querySelectorAll('.foto')];
    // cada foto ocupa una parte de la etapa según su "peso" (un clip largo puede ocupar más)
    const pesos = figs.map((f) => Number(f.dataset.peso) || 1);
    const W = pesos.reduce((a, b) => a + b, 0);
    // cierre: la foto final tiene su momento sola y después se funde para dejar ver el globo
    const closing = sec.hasAttribute('data-cierre');
    let acc = 0;
    figs.forEach((fig, k) => {
      const media = [...fig.querySelectorAll('img, video')];
      const start = i + acc / W; // momento en que esta foto ocupa la pantalla
      const len = pesos[k] / W;
      acc += pesos[k];
      const tin = k === 0 ? i - 0.14 : start - 0.1; // entra un poco antes: nunca hay pantalla vacía
      const end = closing ? i + 0.44 : i + 1.14; // la tapa la etapa siguiente (o el globo, en el cierre)
      // clip con foto nítida al comienzo de la etapa: queda en su primer cuadro hasta la estación (se ve
      // la foto mientras se lee el texto) y avanza en el resto de su tramo
      const hold = fig.hasAttribute('data-nitida') && k === 0 && content.videos?.fotoEnReposo !== false ? HOLD : 0;
      if (hold) holds[i] = true;
      fig.dataset.slot = `${start + hold},${len - hold},${tin},${end}`;
      tl.set(fig, { visibility: 'visible' }, tin);
      if (reduced) {
        tl.fromTo(fig, { opacity: 0 }, { opacity: 1, duration: 0.12 }, tin);
      } else {
        tl.fromTo(fig, { '--w': 0, '--filo': 1 }, { '--w': 100, duration: 0.2, ease: 'power2.inOut' }, tin);
        tl.to(fig, { '--filo': 0, duration: 0.03 }, tin + 0.19);
        // desplazamiento lateral lento hacia la derecha (el contenido corre a la izquierda); los clips ya
        // tienen su propio movimiento, así que el suyo es más suave
        const dx = fig.dataset.clip ? 1.5 : 3;
        tl.fromTo(media, { scale: 1.1, xPercent: dx }, { scale: 1.07, xPercent: -dx, duration: end - tin }, tin);
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
  const clips = createClips({ content, enabled: video });
  // grano fino sobre fotos y clips (capa fija, debajo de los textos)
  const grano = new URLSearchParams(location.search).get('grano');
  if (!reduced && (grano === '1' || (grano !== '0' && content.videos?.grano))) {
    const g = document.createElement('div');
    g.className = 'grano';
    g.setAttribute('aria-hidden', 'true');
    g.style.backgroundImage = `url(${noiseTile()})`;
    journey.append(g);
  }
  clips.items.forEach((it) => {
    const [start, len, tin, end] = it.fig.dataset.slot.split(',').map(Number);
    it.slot = [start, len];
    it.window = [tin, end];
  });
  // estación de cada etapa (adonde llevan el menú y el HUD): con foto nítida, cuando el texto ya entró y
  // el clip todavía está en su primer cuadro
  const station = (i) => (i === 0 ? 0 : i === N - 1 ? i + 0.7 : holds[i] ? i + HOLD : i + 0.4);
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
    // durante el salto no se piden las fotos ni los clips de las etapas que pasan de largo:
    // solo el destino
    navigating = !(immediate || reduced);
    if (navigating) {
      const destU = u != null ? u : i >= 0 ? station(i) : null;
      if (destU != null) {
        const d = Math.min(N - 1, Math.floor(destU));
        clips.want([d]);
        loadStage(d);
      }
    }
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

  const photosReady = (i) =>
    i >= N || [...sections[i].querySelectorAll('.foto img')].every((img) => !img.dataset.src || (img.complete && img.naturalWidth > 0 && img.currentSrc));

  // ---------- mapita + HUD compacto ----------
  const tracker = createTracker(content);
  const rail = createRail(N);

  const navLinks = [...document.querySelectorAll('.menu__list a')];
  const hint = document.querySelector('.scroll-hint');
  let flags = '';

  const tick = (time, deltaMs) => {
    lenis.raf(time * 1000);
    const u = proxy.u;
    if (stage) {
      stage.setTarget(u);
      stage.tick(Math.min(deltaMs, 100) / 1000);
    }

    tracker.update(u, N);

    const idx = Math.min(N - 1, Math.floor(u));
    if (idx !== active) {
      active = idx;
      sections.forEach((sec, k) => sec.classList.toggle('is-active', k === idx));
      navLinks.forEach((l) => (l.getAttribute('href') === `#${sections[idx].id}` ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
    }
    if (!navigating) {
      loadStage(idx);
      loadStage(idx + 1);
      // de a uno: primero el clip de la etapa actual, después el de la siguiente. Las fotos tienen
      // prioridad: los clips se piden recién cuando las fotos de esas dos etapas ya están
      // En el hero no se pide nada hasta que el visitante empieza a scrollear (carga inicial liviana)
      if (u > 0.05 && photosReady(idx) && photosReady(idx + 1)) clips.want([idx, idx + 1]);
    }
    clips.setU(u);
    clips.update(performance.now());
    rail.update(u);
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

  return { lenis, tl, proxy, goTo, N, scrollForU, seek, loadAll, station, clips };
}

// Línea dorada del viaje: corre abajo de todo el recorrido, avanza con el scroll y tiene un punto por
// etapa (01 a 09). Se enciende cada punto al llegar a su etapa.
function createRail(N) {
  const el = document.querySelector('.viaje');
  if (!el) return { update() {} };
  const done = el.querySelector('.viaje__done');
  const dots = [...el.querySelectorAll('.viaje__dot')];
  // en mobile la línea va justo arriba del HUD: se ubica según su alto real (salvo con el mapa grande)
  const tracker = document.querySelector('.tracker');
  if (tracker && 'ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!document.documentElement.classList.contains('is-map-big')) document.documentElement.style.setProperty('--tracker-h', `${tracker.offsetHeight}px`);
    }).observe(tracker);
  }
  let last = '';
  return {
    update(u) {
      const f = Math.min(1, Math.max(0, (u - 1) / (N - 2)));
      const key = f.toFixed(4);
      if (key === last) return;
      last = key;
      done.style.transform = `scaleX(${key})`;
      el.style.setProperty('--f', key);
      dots.forEach((d) => d.classList.toggle('is-on', u >= Number(d.dataset.etapa) - 0.001));
    },
  };
}

// tesela de ruido (gris neutro) para el grano: se genera una vez, 160×160 px
function noiseTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(160, 160);
  for (let k = 0; k < img.data.length; k += 4) {
    const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 90;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
