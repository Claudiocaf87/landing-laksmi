import { content, endBlock, etapa, loadPicture, mapU, N_GLOBAL, picture, reduced, setupScroll, syncPasos, textBlock, versionBar } from './comun.js';

// Versión A · Viaje lateral. Las fotos van una al lado de la otra, como en una ruta: el scroll vertical
// las desplaza en horizontal (de izquierda a derecha, de China hacia América). Una línea dorada continua
// corre por debajo y se enciende un punto en cada etapa. Los textos se mueven a otra velocidad (parallax)
// y hay un leve desenfoque horizontal solo mientras se pasa de una foto a otra.
const IDS = ['ferias', 'negociacion', 'calidad'];
const photos = [];
IDS.forEach((id) => {
  const { e, i } = etapa(id);
  e.fotos.forEach((f, k) => photos.push({ f, stage: id, gi: i, first: k === 0 }));
});
const P = photos.length;
// posición de la foto centrada (0 … P-1) → u global del recorrido (para el HUD, el mapita y los pasos)
const U_POINTS = [
  [0, 2.05],
  [1, 2.4],
  [2, 2.72],
  [2.55, 3.0],
  [3, 3.3],
  [3.45, 3.6],
  [3.6, 4.0],
  [4, 4.4],
];

const main = document.getElementById('contenido');
main.innerHTML = `
<section class="pa" style="--n:${P}">
  <div class="pa__view">
    <svg class="pa__defs" aria-hidden="true" width="0" height="0"><filter id="pa-blur" x="-4%" y="0" width="108%" height="100%"><feGaussianBlur stdDeviation="0 0" /></filter></svg>
    <div class="pa__track">
      ${photos
        .map(
          (p, j) => `<figure class="pa__panel" data-j="${j}" data-etapa="${p.gi}">${picture(content.imagenes.base + p.f.id, { alt: p.f.alt, focal: p.f.focal })}${
            p.f.frase ? `<figcaption class="foto__frase">${p.f.frase}</figcaption>` : ''
          }</figure>`,
        )
        .join('')}
      <div class="pa__road" aria-hidden="true"><span class="pa__road-done"></span>${photos
        .map((p, j) => (p.first ? `<i class="pa__stop" data-j="${j}"></i>` : ''))
        .join('')}</div>
    </div>
    <span class="pa__traveler" aria-hidden="true"></span>
  </div>
</section>`;
const view = main.querySelector('.pa__view');
const track = main.querySelector('.pa__track');
const panels = [...main.querySelectorAll('.pa__panel')];
const stops = [...main.querySelectorAll('.pa__stop')];
const done = main.querySelector('.pa__road-done');
const blur = main.querySelector('#pa-blur feGaussianBlur');
// un bloque de texto por etapa, sobre la primera foto de esa etapa
const texts = IDS.map((id) => {
  const t = textBlock(id);
  t.classList.add('pa__text');
  view.append(t);
  return t;
});
main.append(endBlock('lateral'));
versionBar('lateral');
panels.forEach(loadPicture);

let layout = {};
const measure = () => {
  const vw = window.innerWidth;
  const w = panels[0].offsetWidth;
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  const step = w + gap;
  layout = { vw, w, step, x0: (vw - w) / 2 };
  // posiciones de los puntos de etapa sobre la línea (centro de la primera foto de cada etapa)
  stops.forEach((s) => (s.style.left = `${layout.x0 + Number(s.dataset.j) * step + w / 2}px`));
  main.querySelector('.pa__road').style.width = `${layout.x0 * 2 + (P - 1) * step + w}px`;
};
measure();
window.addEventListener('resize', measure);

let blurOn = false;
setupScroll(main.querySelector('.pa'), (p, { velocity, tracker }) => {
  const pos = p * (P - 1); // foto centrada (fraccionaria)
  const u = mapU(pos, U_POINTS);
  tracker.update(u, N_GLOBAL);
  syncPasos(view, u);
  const stageIdx = Math.floor(u); // 2, 3 o 4

  if (reduced) {
    // solo fundidos: las fotos quedan en su lugar y se cruzan
    panels.forEach((el, j) => (el.style.opacity = String(Math.max(0, 1 - Math.abs(pos - j) * 1.6))));
  } else {
    const x = layout.x0 - pos * layout.step;
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    // la línea dorada avanza hasta el viajero (centro de la pantalla)
    done.style.width = `${(layout.vw / 2 - x).toFixed(1)}px`;
    // desenfoque de movimiento horizontal, solo mientras se mueve
    const b = Math.min(9, Math.abs(velocity) * 0.22);
    if (b > 0.35) {
      blur.setAttribute('stdDeviation', `${b.toFixed(2)} 0`);
      if (!blurOn) track.style.filter = 'url(#pa-blur)';
      blurOn = true;
    } else if (blurOn) {
      track.style.filter = 'none';
      blurOn = false;
    }
  }
  stops.forEach((s) => s.classList.toggle('is-on', pos >= Number(s.dataset.j) - 0.02));

  // textos: el de la etapa actual, con parallax (se desplaza un 25 % más que la foto)
  texts.forEach((t) => {
    const gi = Number(t.dataset.etapa);
    const first = photos.findIndex((ph) => ph.gi === gi);
    const last = photos.length - 1 - [...photos].reverse().findIndex((ph) => ph.gi === gi);
    const on = gi === stageIdx;
    t.classList.toggle('is-on', on);
    if (!reduced) {
      const rel = pos < first ? pos - first : pos > last ? pos - last : 0;
      t.style.transform = `translate3d(${(-rel * layout.step * 1.25).toFixed(1)}px,0,0)`;
    }
  });
});
