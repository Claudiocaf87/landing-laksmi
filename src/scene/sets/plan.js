import { BoxGeometry, Group, Mesh } from 'three';
import { Batch } from '../batch.js';
import { smooth } from '../common.js';

// SET B · Mesa de trabajo (etapa 01). La caja nace plana y se arma mientras se aprueba el plan.
// Mesa con la tapa en y = 0,75, centrada en el origen del set.
const TOP = 0.75;
const W = 0.45; // caja: ancho (X)
const H = 0.32; // alto
const D = 0.35; // profundidad (Z)
const T = 0.006; // espesor del cartón

// Caja desplegable. fold(0) = plana sobre la mesa, fold(1) = armada, close(1) = tapas cerradas.
function foldingBox(mat) {
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(W, T, D).translate(0, T / 2, 0), mat));
  const sides = [];
  // lados ±Z (frente y fondo): bisagra en el borde inferior
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(0, 0, (s * D) / 2);
    pivot.add(new Mesh(new BoxGeometry(W, H, T).translate(0, H / 2, 0), mat));
    root.add(pivot);
    sides.push({ pivot, axis: 'x', s });
  }
  // lados ±X con una tapa superior cada uno
  const flaps = [];
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set((s * W) / 2, 0, 0);
    pivot.add(new Mesh(new BoxGeometry(T, H, D).translate(0, H / 2, 0), mat));
    const flap = new Group();
    flap.position.y = H;
    flap.add(new Mesh(new BoxGeometry(T, W / 2, D).translate(0, W / 4, 0), mat));
    pivot.add(flap);
    root.add(pivot);
    sides.push({ pivot, axis: 'z', s });
    flaps.push({ flap, s });
  }
  root.userData = { sides, flaps };
  root.fold = (f, c) => {
    const a = (1 - f) * Math.PI * 0.5;
    for (const { pivot, axis, s } of sides) {
      if (axis === 'x') pivot.rotation.x = s * a;
      else pivot.rotation.z = -s * a;
    }
    // tapa: plana como prolongación del lado → girada 90° hacia adentro
    for (const { flap, s } of flaps) flap.rotation.z = s * (Math.PI / 2) * c;
  };
  return root;
}

export function buildPlan({ group, mats }) {
  const b = new Batch();
  // ambiente: piso, pared de fondo, ventana
  b.box('ground', 14, 0.1, 10, 0, -0.05, -1);
  b.box('concrete', 14, 4, 0.2, 0, 2, -3.2);
  b.box('emissive', 3.2, 1.6, 0.02, -2.6, 2.1, -3.08);
  // mesa
  b.box('wood', 2.6, 0.06, 1.3, 0, TOP - 0.03, 0);
  for (const x of [-1.2, 1.2]) for (const z of [-0.55, 0.55]) b.box('dark', 0.06, TOP - 0.06, 0.06, x, (TOP - 0.06) / 2, z);
  // notebook
  b.box('dark', 0.5, 0.02, 0.34, -0.78, TOP + 0.01, 0.12);
  b.add(new BoxGeometry(0.5, 0.32, 0.015), 'screen', -0.78, TOP + 0.17, -0.06, -0.25);
  // hoja con el plan (checklist) + lapicera + taza
  b.add(new BoxGeometry(0.3, 0.003, 0.42), 'light', 0.7, TOP + 0.002, 0.08, 0, -0.12);
  for (let i = 0; i < 5; i++) b.add(new BoxGeometry(0.16, 0.002, 0.012), 'mid', 0.72, TOP + 0.005, -0.06 + i * 0.065, 0, -0.12);
  for (let i = 0; i < 5; i++) b.add(new BoxGeometry(0.02, 0.003, 0.02), 'glow', 0.6, TOP + 0.005, -0.045 + i * 0.065, 0, -0.12);
  b.cyl('dark', 0.006, 0.16, 0.95, TOP + 0.006, 0.2, Math.PI / 2, 0.5, 8);
  b.cyl('light', 0.045, 0.1, 1.05, TOP + 0.05, -0.32);
  // cajas planas apiladas (las que vienen después)
  for (let i = 0; i < 4; i++) b.box('box', 0.62, 0.008, 0.5, -0.2, TOP + 0.004 + i * 0.009, -0.42);
  b.flush(group, mats);

  const box = foldingBox(mats.hero);
  box.position.set(0.05, TOP, 0.05);
  group.add(box);

  return {
    update(u) {
      // 1,05 → 1,42 se arma · 1,42 → 1,6 se cierra
      box.fold(smooth(1.06, 1.42, u), smooth(1.44, 1.6, u));
    },
  };
}
