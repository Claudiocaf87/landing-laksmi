import { Color, DirectionalLight, Fog, Group, HemisphereLight } from 'three';
import { makeMaterials } from './common.js';
import { SET_BACKGROUND, SET_OFFSETS } from './layout.js';
import { buildGlobe } from './sets/globe.js';
import { buildPlan } from './sets/plan.js';
import { buildChina } from './sets/china.js';
import { buildPort } from './sets/port.js';
import { buildOcean } from './sets/ocean.js';
import { buildDest } from './sets/dest.js';

const BUILDERS = { globe: buildGlobe, plan: buildPlan, china: buildChina, port: buildPort, ocean: buildOcean, dest: buildDest };

// cede un frame para que el loader se pinte (con timeout por si la pestaña está oculta)
const nextFrame = () =>
  new Promise((r) => {
    requestAnimationFrame(() => r());
    setTimeout(r, 60);
  });

// bruma clara en exteriores (esconde el borde del mundo y suma profundidad)
const FOG = { port: [150, 560], dest: [150, 560] };

export async function buildWorld(scene, { lite = false, manager, onStep = () => {} } = {}) {
  const mats = makeMaterials();
  scene.add(new HemisphereLight(0xffffff, 0xe6dccd, 1.25));
  const sun = new DirectionalLight(0xfff3df, 2.1);
  sun.position.set(0.5, 1, 0.35).multiplyScalar(100);
  scene.add(sun, sun.target);

  const sets = {};
  const names = Object.keys(BUILDERS);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const group = new Group();
    group.name = `set:${name}`;
    group.position.set(...SET_OFFSETS[name]);
    group.visible = false;
    scene.add(group);
    const api = (await BUILDERS[name]({ group, mats, lite, manager })) || {};
    sets[name] = { group, api, bg: new Color(SET_BACKGROUND[name]) };
    group.updateMatrixWorld(true);
    onStep((i + 1) / names.length);
    await nextFrame();
  }

  let active = null;
  return {
    sets,
    mats,
    // muestra solo el set activo y actualiza su animación
    update(u, time, setName) {
      if (setName !== active) {
        if (active) sets[active].group.visible = false;
        sets[setName].group.visible = true;
        active = setName;
        // la luz sigue al set activo (sombras/encuadre de luz en la fase 3)
        const [x, y, z] = SET_OFFSETS[setName];
        sun.target.position.set(x, y, z);
        sun.position.set(x + 50, y + 100, z + 35);
        const f = FOG[setName];
        scene.fog = f ? new Fog(sets[setName].bg.getHex(), f[0], f[1]) : null;
      }
      const s = sets[setName];
      s.api.update?.(u, time);
      scene.background = s.api.background ?? s.bg;
    },
    // para medir: fuerza cada set visible y compila todo antes de mostrar
    showAll(v) {
      for (const n of names) sets[n].group.visible = v;
      active = null;
    },
  };
}
