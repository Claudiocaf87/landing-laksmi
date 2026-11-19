import './styles/main.css';
import { content } from './content/index.js';
import { createLoader } from './ui/loader.js';
import { initForm, initProfiles } from './ui/form.js';
import { initMenu } from './ui/menu.js';

const root = document.documentElement;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const params = new URLSearchParams(location.search);
const modo = params.get('modo'); // ?modo=estatico | liviano | cortes (para probar)
const measure = params.has('medir'); // expone __stage/__journey también en producción

let stage = null;
let journey = null;
if (import.meta.env.DEV) import('./ui/devpanel.js').then(({ mountDevPanel }) => mountDevPanel(() => stage));

function hasWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

// --- capacidades del dispositivo ---
// El recorrido fotográfico funciona en todos lados; el 3D es solo el globo.
// Sin WebGL, con ahorro de datos o en gama baja, el globo se reemplaza por su imagen fija.
const conn = navigator.connection || {};
const saveData = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || modo === 'cortes';
const lowEnd = modo === 'liviano' || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const isStatic = modo === 'estatico';
const want3D = !isStatic && !saveData && !lowEnd && hasWebGL2();
// modo video: clips con scroll solo con buena conexión y equipo; si no, foto con desplazamiento lateral
const slowNet = /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
const wantVideo = !isStatic && !saveData && !slowNet && !lowEnd && !reducedMotion && modo !== 'sin-video';
root.classList.toggle('no-globe', !want3D);

initForm(content);
const goTo = (id) => {
  if (journey) journey.goTo(id);
  else document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
};
initMenu({
  labels: content.ui,
  onOpen: () => journey?.lenis.stop(),
  onClose: () => journey?.lenis.start(),
});
initProfiles(goTo);

// versión estática: fotos y textos apilados (carga diferida nativa)
function loadStatic() {
  document.querySelectorAll('.etapa picture').forEach((pic) => {
    pic.querySelectorAll('source[data-srcset]').forEach((s) => (s.srcset = s.dataset.srcset));
    const img = pic.querySelector('img[data-src]');
    if (img) {
      img.loading = 'lazy';
      img.src = img.dataset.src;
    }
  });
}

async function boot() {
  const loader = createLoader();
  if (isStatic) {
    root.classList.add('is-static');
    loadStatic();
    await loader.done();
    return;
  }
  try {
    loader.set(0.1);
    const jsP = import('./journey.js');
    if (want3D) {
      try {
        const { Stage } = await import('./scene/Stage.js');
        loader.set(0.35);
        stage = new Stage(document.querySelector('.stage'), { snap: reducedMotion, onProgress: (p) => loader.set(0.35 + p * 0.6) });
        await stage.build();
      } catch (err) {
        console.error('[globo] no se pudo iniciar; se usa la imagen fija', err);
        stage = null;
        root.classList.add('no-globe');
      }
    }
    await document.fonts.ready;
    const { createJourney } = await jsP;
    journey = createJourney({ stage, content, reduced: reducedMotion, video: wantVideo });
    if (import.meta.env.DEV || measure) Object.assign(window, { __stage: stage, __journey: journey });
    await loader.done();
  } catch (err) {
    console.error('[recorrido] no se pudo iniciar; se usa la versión estática', err);
    root.classList.remove('is-journey');
    root.classList.add('is-static');
    loadStatic();
    await loader.done();
  }
}

boot();
