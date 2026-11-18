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
const conn = navigator.connection || {};
const saveData = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || modo === 'cortes';
const coarse = window.matchMedia('(pointer: coarse)').matches;
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const lite = modo === 'liviano' || coarse || lowEnd;
const want3D = modo !== 'estatico' && !saveData && hasWebGL2();
root.classList.toggle('is-lite', lite);

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

async function boot() {
  const loader = createLoader();
  if (!want3D) {
    root.classList.add('is-static');
    await loader.done();
    return;
  }
  try {
    loader.set(0.04);
    await document.fonts.ready;
    loader.set(0.1);
    const [{ Stage }, { createJourney }] = await Promise.all([import('./scene/Stage.js'), import('./journey.js')]);
    loader.set(0.25);
    stage = new Stage(document.querySelector('.stage'), {
      lite,
      snap: reducedMotion,
      veil: document.querySelector('.veil'),
      onProgress: (p) => loader.set(0.25 + p * 0.75),
    });
    await stage.build();
    journey = createJourney(stage, content);
    if (import.meta.env.DEV || measure) Object.assign(window, { __stage: stage, __journey: journey });
    await loader.done();
  } catch (err) {
    console.error('[3d] no se pudo iniciar; se usa la versión estática', err);
    root.classList.remove('is-journey');
    root.classList.add('is-static');
    await loader.done();
  }
}

boot();
