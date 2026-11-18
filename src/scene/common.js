import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Escena gris (fase 2): materiales neutros. En la fase 3 se reemplazan por los finales
// sin tocar la geometría (cada set pide los materiales por clave).
export function makeMaterials() {
  const std = (color, roughness = 0.85, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });
  return {
    ground: std(0x4b4744, 0.95),
    concrete: std(0x5f5a56, 0.95),
    dark: std(0x2f2a28, 0.8),
    mid: std(0x77716c, 0.75),
    light: std(0xaaa39c, 0.65),
    metal: std(0x8b8580, 0.5, 0.2),
    wood: std(0x6e6258, 0.9),
    box: std(0x9a8d7e, 0.9),
    hero: std(0xd6a648, 0.7), // la caja protagonista: único acento en la escena gris
    container: std(0xffffff, 0.7), // se tiñe por instancia
    person: std(0x8e8882, 0.8),
    screen: new MeshBasicMaterial({ color: 0x34302d }),
    poster: std(0x8d8780, 0.9),
    emissive: new MeshBasicMaterial({ color: 0xf2ece4 }),
    glow: new MeshBasicMaterial({ color: 0xfbae17 }),
  };
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

// Interpola una lista de claves [{u, ...valores}] para un u dado.
export function keyframes(keys, u, field) {
  if (u <= keys[0].u) return keys[0][field];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (u <= b.u) return lerp(a[field], b[field], smooth(a.u, b.u, u));
  }
  return keys[keys.length - 1][field];
}

// ---------- instancias ----------
const _o = new Object3D();
export function instanced(geo, mat, items, { colors = null, name = 'instancias' } = {}) {
  const mesh = new InstancedMesh(geo, mat, Math.max(1, items.length));
  mesh.count = items.length;
  const c = new Color();
  items.forEach((it, i) => {
    _o.position.set(it.x, it.y, it.z);
    _o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    _o.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    _o.updateMatrix();
    mesh.setMatrixAt(i, _o.matrix);
    if (colors) mesh.setColorAt(i, c.set(it.color ?? colors[i % colors.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = name;
  mesh.computeBoundingSphere();
  return mesh;
}

export function setInstance(mesh, i, x, y, z, ry = 0, s = 1) {
  _o.position.set(x, y, z);
  _o.rotation.set(0, ry, 0);
  _o.scale.setScalar(s);
  _o.updateMatrix();
  mesh.setMatrixAt(i, _o.matrix);
}

// Contenedores: un cubo unitario escalado por instancia (40' = 12,19 × 2,59 × 2,44 m).
export const CONTAINER_40 = { sx: 12.19, sy: 2.59, sz: 2.44 };
export const CONTAINER_GREYS = [0x6d6864, 0x86807b, 0x5a5552, 0x9a948e, 0x77716c];
export const unitBox = new BoxGeometry(1, 1, 1);

// Pila de contenedores alineados con el eje X. Devuelve items para instanced().
export function stack(items, { x, z, bays, rows, tiers, y = 0, gapX = 0.6, gapZ = 0.15, fill = 1, seed = 1 }) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let b = 0; b < bays; b++)
    for (let r = 0; r < rows; r++) {
      const h = Math.max(1, Math.round(tiers * (fill + (1 - fill) * rnd())));
      for (let t = 0; t < h; t++)
        items.push({
          x: x + b * (CONTAINER_40.sx + gapX),
          y: y + CONTAINER_40.sy * (t + 0.5),
          z: z + r * (CONTAINER_40.sz + gapZ),
          ...CONTAINER_40,
        });
    }
  return items;
}

// ---------- geometrías compuestas ----------
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();
export function placed(geo, x, y, z, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, 1)));
  return geo;
}

// Persona estilizada (cuerpo + cabeza) de 1,75 m, en una sola geometría para instanciar.
export function personGeometry() {
  const body = placed(new CapsuleGeometry(0.2, 0.85, 4, 10), 0, 0.68 + 0.2, 0);
  const head = placed(new SphereGeometry(0.13, 12, 8), 0, 1.6, 0);
  return mergeGeometries([body, head]);
}

// Caja de cartón cerrada (0,45 × 0,32 × 0,35 m) con la base en y = 0.
export function crateGeometry(w = 0.45, h = 0.32, d = 0.35) {
  return new BoxGeometry(w, h, d).translate(0, h / 2, 0);
}

// Camión con chasis portacontenedor. Frente hacia +X. Devuelve un Group con 2 meshes.
export function createTruck(mats) {
  const body = [];
  body.push(placed(new BoxGeometry(2.4, 2.6, 2.5), 0, 2.0, 0)); // cabina
  body.push(placed(new BoxGeometry(0.4, 1.6, 2.4), -1.4, 1.6, 0));
  body.push(placed(new BoxGeometry(13.2, 0.35, 2.3), -7.6, 1.15, 0)); // chasis
  const wheels = [];
  for (const x of [0.2, -4.2, -11.2, -12.6]) for (const z of [-1.05, 1.05]) wheels.push(placed(new CylinderGeometry(0.5, 0.5, 0.4, 14), x, 0.5, z, 0, Math.PI / 2));
  const g = new Group();
  g.add(new Mesh(mergeGeometries(body), mats.mid), new Mesh(mergeGeometries(wheels), mats.dark));
  g.name = 'camion';
  return g;
}

// Contenedor protagonista de 20' (6,06 × 2,59 × 2,44) con puertas en -X.
// shell: paredes con espesor (se puede ver desde adentro); doors: dos hojas con bisagra.
export function createHeroContainer(mat, doorMat = mat) {
  const L = 6.06;
  const H = 2.59;
  const W = 2.44;
  const t = 0.06;
  const parts = [
    placed(new BoxGeometry(L, t, W), 0, t / 2, 0),
    placed(new BoxGeometry(L, t, W), 0, H - t / 2, 0),
    placed(new BoxGeometry(L, H, t), 0, H / 2, -W / 2 + t / 2),
    placed(new BoxGeometry(L, H, t), 0, H / 2, W / 2 - t / 2),
    placed(new BoxGeometry(t, H, W), L / 2 - t / 2, H / 2, 0),
  ];
  const g = new Group();
  g.name = 'contenedor';
  const shell = new Mesh(mergeGeometries(parts), mat);
  g.add(shell);
  const doors = [];
  for (const side of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(-L / 2, 0, side * (W / 2));
    const leaf = new Mesh(new BoxGeometry(0.06, H - 0.1, W / 2).translate(-0.03, H / 2, -side * (W / 4)), doorMat);
    pivot.add(leaf);
    g.add(pivot);
    doors.push({ pivot, side });
  }
  const seal = new Mesh(new CylinderGeometry(0.03, 0.03, 0.22, 8), doorMat);
  seal.position.set(-L / 2 - 0.09, 1.25, 0.12);
  g.add(seal);
  g.userData = { L, H, W, shell, doors, seal };
  // abre (1) o cierra (0) las puertas
  g.setDoors = (open) => doors.forEach(({ pivot, side }) => (pivot.rotation.y = side * open * Math.PI * 0.62));
  return g;
}

// Grúa pórtico de muelle (STS). Lado mar hacia -Z. Estática al batch; carro y spreader aparte.
export const CRANE = { legZ: [2, 20], top: 38, boomY: 42, boomFrom: 28, boomTo: -44, gauge: 16 };
export function buildCrane(b, x, key = 'metal') {
  const { legZ, top, boomY, boomFrom, boomTo, gauge } = CRANE;
  for (const z of legZ) for (const dx of [-gauge / 2, gauge / 2]) b.box(key, 1.2, top, 1.2, x + dx, top / 2, z);
  for (const z of legZ) b.box(key, gauge + 1.2, 1.4, 1.4, x, top, z); // vigas portal
  for (const dx of [-gauge / 2, gauge / 2]) b.box(key, 1.2, 1.2, legZ[1] - legZ[0], x + dx, top, (legZ[0] + legZ[1]) / 2);
  for (const dx of [-3.2, 3.2]) b.box(key, 1.0, 1.6, boomFrom - boomTo, x + dx, boomY, (boomFrom + boomTo) / 2); // pluma
  b.box('dark', 8, 4, 7, x, boomY + 2.2, 15); // sala de máquinas
  b.box(key, 1, 12, 1, x, top + 8, 9); // torre
  b.box('dark', 2.6, 2.4, 2.6, x + 4.4, boomY - 2.4, -4); // cabina del operador
  for (const dx of [-gauge / 2, gauge / 2]) b.box('dark', 2.6, 1.2, 4, x + dx, 0.6, legZ[0]);
  for (const dx of [-gauge / 2, gauge / 2]) b.box('dark', 2.6, 1.2, 4, x + dx, 0.6, legZ[1]);
}

// Carro + cables + spreader. setLoad(z, y): z del carro sobre la pluma, y del spreader.
export function createTrolley(mats) {
  const g = new Group();
  const cart = new Mesh(new BoxGeometry(7, 1.4, 4), mats.dark);
  cart.position.y = CRANE.boomY - 1.2;
  const cable = new Mesh(new BoxGeometry(0.08, 1, 0.08).translate(0, -0.5, 0), mats.dark);
  const cable2 = cable.clone();
  const spreader = new Mesh(new BoxGeometry(6.2, 0.5, 2.5), mats.mid);
  g.add(cart, cable, cable2, spreader);
  g.setLoad = (z, y) => {
    cart.position.z = z;
    spreader.position.set(0, y + 0.25, z);
    const len = cart.position.y - (y + 0.5);
    for (const [c, dx] of [
      [cable, -2.2],
      [cable2, 2.2],
    ]) {
      c.position.set(dx, cart.position.y - 0.7, z);
      c.scale.y = Math.max(0.1, len - 0.7);
    }
  };
  return g;
}

// Buque portacontenedores. Eslora sobre X (proa en +X), cubierta en y = deck.
export const SHIP = { L: 150, W: 24, deck: 7, keel: -6 };
export function shipHullGeometry() {
  const { L, W, deck, keel } = SHIP;
  const s = new Shape();
  const bow = 22;
  s.moveTo(-L / 2, -W / 2);
  s.lineTo(L / 2 - bow, -W / 2);
  s.quadraticCurveTo(L / 2, -W / 2 + 2, L / 2, 0);
  s.quadraticCurveTo(L / 2, W / 2 - 2, L / 2 - bow, W / 2);
  s.lineTo(-L / 2, W / 2);
  s.lineTo(-L / 2, -W / 2);
  const geo = new ExtrudeGeometry(s, { depth: deck - keel, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2); // forma en XZ, extrusión hacia +Y
  geo.translate(0, keel, 0);
  return geo;
}

// Barco completo: casco, castillo de popa y carga (instanciada). Devuelve un Group.
export function createShip(mats, { seed = 3 } = {}) {
  const g = new Group();
  g.name = 'barco';
  const { L, W, deck } = SHIP;
  g.add(new Mesh(shipHullGeometry(), mats.dark));
  const bridge = mergeGeometries([
    placed(new BoxGeometry(12, 16, W - 4), -L / 2 + 14, deck + 8, 0),
    placed(new BoxGeometry(8, 3, W + 4), -L / 2 + 14, deck + 17.5, 0),
    placed(new BoxGeometry(3, 10, 3), -L / 2 + 9, deck + 20, 0),
  ]);
  g.add(new Mesh(bridge, mats.light));
  const items = [];
  stack(items, { x: -L / 2 + 30, z: -W / 2 + 2.2, bays: 8, rows: 8, tiers: 4, y: deck, fill: 0.45, seed });
  const cargo = instanced(unitBox, mats.container, items, { colors: CONTAINER_GREYS, name: 'carga-barco' });
  g.add(cargo);
  return g;
}

// Textura provisoria para una foto recortada (silueta + etiqueta). Se reemplaza por un PNG en la fase 4.
export function silhouetteTexture(label = '[FOTO RECORTADA]') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#8e8882';
  x.beginPath();
  x.arc(128, 96, 52, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.moveTo(40, 512);
  x.quadraticCurveTo(30, 190, 128, 170);
  x.quadraticCurveTo(226, 190, 216, 512);
  x.fill();
  x.fillStyle = '#2f2a28';
  x.font = '600 20px Poppins, sans-serif';
  x.textAlign = 'center';
  x.fillText(label, 128, 340);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function cutoutMesh(texture, w, h) {
  const mat = new MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: DoubleSide });
  return new Mesh(new PlaneGeometry(w, h).translate(0, h / 2, 0), mat);
}
