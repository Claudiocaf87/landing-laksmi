import { MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three';
import { content } from '../content/index.js';
import { SLOTS } from './sets/china.js';

// Texturas que no hacen falta para el hero: se piden después del primer fotograma, cuando el
// navegador está libre. Así no suman a la carga inicial. En modo liviano se usa la versión -mobile.
// Qué imagen va en cada cartel se define en es.json → imagenes.asignacion.
export function loadDeferred(stage) {
  const tag = stage.lite ? 'mobile' : 'desktop';
  const img = content.imagenes;
  const byId = Object.fromEntries(img.carteles.map((c) => [c.id, c]));
  const loader = new TextureLoader();
  const maxAniso = stage.renderer.capabilities.getMaxAnisotropy();
  const load = (url) =>
    loader.loadAsync(url).then((t) => {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = Math.min(4, maxAniso);
      return t;
    });
  const asLightbox = (mesh, t) => {
    mesh.material = new MeshBasicMaterial({ map: t, toneMapped: false }); // cartel retroiluminado
  };

  const jobs = [];
  const { stands = [], banderolas = [], pantalla } = img.asignacion || {};
  const posters = SLOTS.posters;
  const nStands = posters.length - banderolas.length;
  posters.forEach((mesh, i) => {
    const id = i < nStands ? stands[i % stands.length] : banderolas[i - nStands];
    if (id && byId[id]) jobs.push(load(`${byId[id].base}-${tag}.webp`).then((t) => asLightbox(mesh, t)));
  });
  if (pantalla && byId[pantalla]) SLOTS.screens.forEach((m) => jobs.push(load(`${byId[pantalla].base}-${tag}.webp`).then((t) => asLightbox(m, t))));
  if (img.recorte) {
    const dest = stage.world.sets.dest.api;
    jobs.push(load(`${img.recorte.base}-${tag}.webp`).then((t) => dest.setCutout?.(t)));
  }
  return Promise.allSettled(jobs);
}
