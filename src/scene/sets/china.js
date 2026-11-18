import { CylinderGeometry, Mesh, PlaneGeometry } from 'three';
import { Batch, room, wall } from '../batch.js';
import { crateGeometry, instanced, personGeometry, setInstance, smooth, unitBox } from '../common.js';

// SET C · China (etapas 02 y 03). Planta (Z negativo = hacia adentro):
//   z   +6 … -30   showroom / feria (pasillo central en x = 0)
//   z  -30 … -66   planta con cinta transportadora en x = 3
//   z  -66 … -86   control de calidad: mesa de inspección en (0, -76)
export const QC = { x: 0, z: -76, top: 0.92 };

// Huecos para fotos/carteles y video (fase 4): se exponen para cargarles texturas.
export const SLOTS = { posters: [], screens: [] };

export function buildChina({ group, mats, lite }) {
  const b = new Batch();

  // ---------- showroom ----------
  room(b, { hw: 14, zNear: 6, zFar: -30, h: 8, floor: 'ground', walls: 'concrete', ceiling: 'dark' });
  wall(b, 'concrete', 6, 14, 8, 0, 0); // pared de entrada (detrás de la cámara)
  wall(b, 'concrete', -30, 14, 8, 6, 5); // paso a la planta
  for (let z = 2; z > -30; z -= 6) b.box('emissive', 10, 0.08, 0.5, 0, 7.9, z); // luminarias

  const products = [];
  const productsRound = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const zc = -1 - k * 5.6;
      const x = side * 7.2;
      // stand: fondo, piso elevado, dos estanterías y cartel
      b.box('mid', 0.15, 3.2, 5, side * 9.6, 1.6, zc);
      b.box('dark', 5, 0.08, 5, side * 7.3, 0.04, zc);
      for (const dz of [-1.3, 1.3]) {
        for (const lvl of [0.4, 1.05, 1.7]) b.box('light', 1.2, 0.04, 2, x + side * 1.2, lvl, zc + dz);
        b.box('dark', 1.2, 2, 0.05, x + side * 1.2, 1, zc + dz - 1);
        for (const lvl of [0.4, 1.05, 1.7]) {
          for (let i = 0; i < 4; i++) {
            const item = { x: x + side * (1.0 + rnd() * 0.4), y: lvl + 0.02, z: zc + dz - 0.75 + i * 0.5 };
            if (rnd() > 0.45) {
              const s = 0.16 + rnd() * 0.18;
              products.push({ ...item, y: item.y + s / 2, sx: s, sy: s * (0.8 + rnd()), sz: s, ry: rnd() });
            } else {
              const s = 0.09 + rnd() * 0.08;
              productsRound.push({ ...item, y: item.y + s * 1.5, sx: s * 10, sy: s * 10, sz: s * 10 });
            }
          }
        }
      }
      // mostrador
      b.box('mid', 0.6, 1, 1.8, side * 5.2, 0.5, zc);
      // cartel del stand (hueco para foto)
      const poster = new Mesh(new PlaneGeometry(3.4, 1.9), mats.poster);
      poster.position.set(side * 9.5, 4.3, zc);
      poster.rotation.y = -side * Math.PI * 0.5;
      group.add(poster);
      SLOTS.posters.push(poster);
    }
  }
  // banderolas colgantes sobre el pasillo (huecos para fotos)
  for (const z of [-8, -20]) {
    const banner = new Mesh(new PlaneGeometry(4.5, 2.2), mats.poster);
    banner.position.set(0, 5.6, z);
    group.add(banner);
    SLOTS.posters.push(banner);
  }

  // ---------- planta ----------
  room(b, { hw: 18, zNear: -30, zFar: -86, h: 11, floor: 'ground', walls: 'concrete', ceiling: 'dark' });
  wall(b, 'concrete', -86, 18, 11, 0, 0);
  for (let z = -34; z > -86; z -= 7) b.box('metal', 36, 0.5, 0.4, 0, 10.4, z); // cerchas
  for (let z = -36; z > -66; z -= 6) b.box('emissive', 0.5, 0.08, 4, 3, 10, z);
  // cinta transportadora (de -36 a -66)
  b.box('dark', 1, 0.12, 30, 3, 0.86, -51);
  for (const dx of [-0.55, 0.55]) b.box('metal', 0.1, 0.22, 30, 3 + dx, 0.9, -51);
  for (let z = -37; z > -66; z -= 3) for (const dx of [-0.45, 0.45]) b.box('metal', 0.08, 0.8, 0.08, 3 + dx, 0.4, z);
  // máquinas a los lados
  for (let i = 0; i < 4; i++) {
    const z = -38 - i * 7.5;
    b.box('mid', 3, 2.4 + (i % 2) * 0.8, 2.6, 7, 1.3, z);
    b.box('dark', 1.4, 0.8, 0.1, 5.45, 1.8, z);
    b.box('mid', 2.4, 1.8, 3.4, -4, 0.9, z - 1);
  }
  // estanterías de stock al fondo izquierdo
  for (let i = 0; i < 3; i++) {
    const z = -40 - i * 8;
    for (const lvl of [0.1, 2, 3.9]) b.box('metal', 1.4, 0.1, 6, -15.5, lvl, z);
    for (const dz of [-2.9, 2.9]) b.box('metal', 0.1, 5.6, 0.1, -14.9, 2.8, z + dz);
  }
  // pantalla grande (hueco para el video en loop)
  b.box('dark', 0.2, 3.8, 6.6, -17.8, 5.2, -50);
  const screen = new Mesh(new PlaneGeometry(6.2, 3.48), mats.screen);
  screen.position.set(-17.65, 5.2, -50);
  screen.rotation.y = Math.PI / 2;
  group.add(screen);
  SLOTS.screens.push(screen);

  // ---------- control de calidad ----------
  b.box('wood', 3.2, 0.06, 1.6, QC.x, QC.top - 0.03, QC.z);
  for (const x of [-1.5, 1.5]) for (const z of [-0.7, 0.7]) b.box('dark', 0.07, QC.top - 0.06, 0.07, QC.x + x, (QC.top - 0.06) / 2, QC.z + z);
  b.box('emissive', 2.4, 0.06, 0.9, QC.x, 2.7, QC.z); // luz de inspección
  b.box('dark', 2.6, 0.12, 1.1, QC.x, 2.79, QC.z);
  for (const x of [-1.1, 1.1]) b.box('dark', 0.02, 8.2, 0.02, QC.x + x, 6.9, QC.z);
  // tablet con checklist sobre la mesa
  b.box('dark', 0.26, 0.012, 0.19, QC.x - 0.95, QC.top + 0.006, QC.z + 0.4);
  b.box('emissive', 0.23, 0.002, 0.16, QC.x - 0.95, QC.top + 0.013, QC.z + 0.4);
  // pallets
  for (const [px, pz] of [
    [-5, -74],
    [-5, -78.5],
    [5.5, -73],
    [5.5, -79],
  ]) {
    b.box('wood', 1.2, 0.15, 1.2, px, 0.075, pz);
  }
  b.flush(group, mats);

  // cajas: estáticas sobre pallets y la mesa (1 draw call)
  const crateGeo = crateGeometry();
  const crates = [];
  for (const [px, pz, layers] of [
    [-5, -74, 3],
    [-5, -78.5, 2],
    [5.5, -73, 3],
    [5.5, -79, 1],
  ]) {
    for (let l = 0; l < layers; l++) for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 3; iz++) crates.push({ x: px - 0.25 + ix * 0.5, y: 0.15 + l * 0.33, z: pz - 0.38 + iz * 0.38 });
  }
  for (const [dx, dz, ry] of [
    [-0.7, -0.25, 0.1],
    [0.75, -0.3, -0.15],
    [0.95, 0.3, 0.3],
  ])
    crates.push({ x: QC.x + dx, y: QC.top, z: QC.z + dz, ry });
  group.add(instanced(crateGeo, mats.box, crates, { name: 'cajas' }));

  // productos del showroom (2 draw calls)
  group.add(instanced(unitBox, mats.light, products, { name: 'productos' }));
  group.add(instanced(new CylinderGeometry(0.1, 0.1, 0.3, 10), mats.mid, productsRound, { name: 'productos-redondos' }));

  // caja protagonista sobre la mesa de inspección, con tapas abiertas
  const hero = new Mesh(crateGeo, mats.hero);
  hero.position.set(QC.x, QC.top, QC.z + 0.05);
  group.add(hero);
  const flaps = [-1, 1].map((s) => {
    const f = new Mesh(unitBox, mats.hero);
    f.scale.set(0.225, 0.006, 0.35);
    f.geometry = unitBox;
    group.add(f);
    return { f, s };
  });

  // cajas en la cinta (animadas)
  const BELT = 18;
  const belt = instanced(crateGeo, mats.box, Array.from({ length: BELT }, () => ({ x: 3, y: 0.92, z: -40 })), { name: 'cajas-cinta' });
  belt.frustumCulled = false;
  group.add(belt);

  // personas: visitantes, operarios e inspectores (1 draw call)
  const people = [
    { x: -1.2, y: 0, z: -6, ry: 0.4 },
    { x: 4.6, y: 0, z: -12, ry: -1.4 },
    { x: -4.8, y: 0, z: -18, ry: 1.6 },
    { x: 1.4, y: 0, z: -23, ry: 3 },
    { x: 1.8, y: 0, z: -42, ry: Math.PI / 2 },
    { x: 4.3, y: 0, z: -47, ry: -Math.PI / 2 },
    { x: 1.8, y: 0, z: -55, ry: Math.PI / 2 },
    { x: 4.3, y: 0, z: -60, ry: -Math.PI / 2 },
    { x: -2.4, y: 0, z: -50, ry: 0.8 }, // supervisor
    { x: QC.x - 0.4, y: 0, z: QC.z - 1.15, ry: 0 },
    { x: QC.x + 0.9, y: 0, z: QC.z - 1.1, ry: -0.2 },
  ];
  group.add(instanced(personGeometry(), mats.person, people, { name: 'personas' }));

  return {
    update(u, time) {
      // cinta: las cajas avanzan hacia el fondo
      for (let i = 0; i < BELT; i++) {
        const z = -37 - ((time * 0.9 + i * (28 / BELT)) % 28);
        setInstance(belt, i, 3, 0.92, z);
      }
      belt.instanceMatrix.needsUpdate = true;
      // caja protagonista: abierta durante la inspección, se cierra al aprobarse (3,62 → 3,8)
      const close = smooth(3.62, 3.8, u);
      for (const { f, s } of flaps) {
        const a = (1 - close) * Math.PI * 0.62;
        f.rotation.set(0, 0, s * -a);
        // bisagra en el borde superior de cada lado X
        const hx = QC.x + s * 0.225;
        f.position.set(hx - s * Math.cos(a) * 0.1125, QC.top + 0.32 + Math.sin(a) * 0.1125, QC.z + 0.05);
      }
    },
  };
}
