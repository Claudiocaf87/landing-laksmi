import { content, endBlock, etapa, loadPicture, lowEnd, N_GLOBAL, picture, portrait, reduced, saveData, setupScroll, syncPasos, textBlock, versionBar } from './comun.js';

// Versión C · Video que avanza con el scroll, solo en la etapa del puerto
// (Cargado y precintado → Embarcado): carga → precinto (fotos) → puerto (video con scrubbing).
// El video no se pide hasta acercarse; mientras carga (y como alternativa con ahorro de datos,
// gama baja, reduced motion o si falla) se ve la foto del puerto.
// ?fps=12 usa la variante con menos cuadros por segundo, para comparar.
const { e, i: gi } = etapa('despacho');
const fps = new URLSearchParams(location.search).get('fps') === '12' ? 12 : 24;
const V = content.prototipos.video;
const base = content.imagenes.base;
const fotos = e.fotos.filter((f) => f.id !== 'puerto');
const puerto = e.fotos.find((f) => f.id === 'puerto');
const useVideo = !reduced && !saveData && !lowEnd;

const main = document.getElementById('contenido');
main.innerHTML = `
<section class="pc">
  <div class="pc__view">
    ${fotos.map((f, k) => `<figure class="pc__layer" data-k="${k}">${picture(base + f.id, { alt: f.alt, focal: f.focal })}</figure>`).join('')}
    <figure class="pc__layer pc__puerto" data-k="${fotos.length}">
      ${picture(base + puerto.id, { alt: puerto.alt, focal: puerto.focal })}
      ${useVideo ? `<video class="pc__video" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>` : ''}
    </figure>
  </div>
</section>`;
const view = main.querySelector('.pc__view');
const layers = [...main.querySelectorAll('.pc__layer')];
const text = textBlock('despacho');
text.classList.add('pc__text', 'is-on');
view.append(text);
main.append(endBlock('video'));
versionBar('video');
layers.forEach(loadPicture);

const video = main.querySelector('video');
let videoReady = false;
const status = { variante: `${fps} fps`, fuente: null, listo: false, falló: false };
window.__video = status;
const attachVideo = () => {
  if (!video || video.dataset.on) return;
  video.dataset.on = '1';
  const t = portrait() ? V.mobile : V.desktop;
  const webm = video.canPlayType('video/webm; codecs="vp9"');
  // en fase3-video el clip del puerto es v2 (npm run videos): una sola variante a 24 fps
  status.fuente = `${t.split('/').pop()}.${webm ? 'webm' : 'mp4'}`;
  video.src = `${t}.${webm ? 'webm' : 'mp4'}`;
  video.preload = 'auto';
  video.load();
  video.addEventListener('loadeddata', () => {
    videoReady = true;
    status.listo = true;
    video.classList.add('is-ready');
  });
  video.addEventListener('error', () => {
    status.falló = true;
    video.remove(); // queda la foto del puerto
  });
};

// tramo: 0 … 0.28 carga · 0.28 … 0.5 precinto · 0.5 … 1 puerto (el video avanza de 0 a 8 s)
const VIDEO_FROM = 0.5;
let wanted = 0;
setupScroll(main.querySelector('.pc'), (p, { tracker }) => {
  const u = gi + p; // la etapa 05 completa en el u global
  tracker.update(u, N_GLOBAL);
  syncPasos(view, u);
  if (p > 0.12) attachVideo(); // se pide al acercarse a la toma del puerto
  // cada capa se funde encima de la anterior al empezar su tramo (con un zoom lento en las fotos)
  layers.forEach((el, k) => {
    const start = [0, 0.24, 0.46][k];
    const op = k === 0 ? 1 : Math.min(1, Math.max(0, (p - start) / 0.06));
    el.style.opacity = String(op);
    el.style.visibility = op > 0 ? 'visible' : 'hidden';
    const img = el.querySelector('img');
    if (img && !reduced) img.style.transform = `scale(${(1.08 - 0.08 * Math.min(1, Math.max(0, (p - start) / 0.3))).toFixed(4)})`;
  });
  if (video && videoReady && video.duration) {
    wanted = Math.min(video.duration - 0.05, Math.max(0, ((p - VIDEO_FROM) / (1 - VIDEO_FROM)) * video.duration));
    // no encolar búsquedas: solo cuando terminó la anterior y el cambio supera medio cuadro
    if (!video.seeking && Math.abs(video.currentTime - wanted) > 0.5 / fps) video.currentTime = wanted;
  }
});
