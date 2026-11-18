import {
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  FileLoader,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { clamp01, keyframes, smooth } from '../common.js';

// SET A · Globo (etapa 00 y cierre de la 08). Radio 10, centrado en el origen del set.
// Los puntos de tierra salen de public/assets/data/globo-puntos.bin (npm run globo).
export const R = 10;
const D2R = Math.PI / 180;

export function latLon(lat, lon, r = R, v = new Vector3()) {
  const p = lat * D2R;
  const l = lon * D2R;
  return v.set(r * Math.cos(p) * Math.sin(l), r * Math.sin(p), r * Math.cos(p) * Math.cos(l));
}

// Longitudes "desenrolladas" (> 180 = oeste) para que las rutas crucen el Pacífico sin saltos.
const OFFICES = [
  [29.31, 120.08], // Yiwu
  [23.13, 113.26], // Guangzhou
  [29.87, 121.54], // Ningbo
  [23.35, 116.68], // Shantou
];
const LATAM = [
  [10.48, 293.1], // Caracas
  [10.96, 296.15], // Margarita
  [4.71, 285.93], // Bogotá
  [-12.05, 282.96], // Lima
  [-33.45, 289.33], // Santiago
  [19.43, 260.87], // Ciudad de México
];
// Ruta estilizada (no es un trazado de navegación real).
const MAIN_ROUTE = [
  [29.0, 123.5], [30, 140], [27, 162], [22, 188], [16, 215], [11, 245], [7.6, 279], [9.2, 280.3], [10.8, 283], [10.9, 293],
];
const BRANCHES = [
  [[16, 215], [17.6, 240], [19.05, 255.7]], // México
  [[11, 245], [6.5, 268], [3.9, 282.9]], // Colombia
  [[11, 245], [-3, 266], [-12.05, 282.6]], // Perú
  [[11, 245], [-14, 262], [-33.6, 288]], // Chile
];

function routeGeometry(waypoints, lift = 0.07, seg = 180) {
  const flat = new CatmullRomCurve3(waypoints.map(([la, lo]) => new Vector3(lo, la, 0)), false, 'centripetal');
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const q = flat.getPoint(t);
    pts.push(latLon(q.y, q.x, R * (1.012 + lift * Math.sin(Math.PI * t))));
  }
  const geo = new TubeGeometry(new CatmullRomCurve3(pts), seg, 0.055, 6, false);
  geo.userData.per = 6 * 6; // índices por segmento tubular
  geo.userData.seg = seg;
  return geo;
}
const reveal = (mesh, p) => {
  const { per, seg } = mesh.geometry.userData;
  mesh.geometry.setDrawRange(0, Math.floor(clamp01(p) * seg) * per);
  mesh.visible = p > 0.001;
};

// Hacia dónde mira el globo (lat/lon al frente) según u.
const FOCUS_OPEN = [
  { u: 0, lat: 24, lon: 197 },
  { u: 0.5, lat: 22, lon: 200 },
  { u: 0.98, lat: 29, lon: 122 },
];
const FOCUS_CLOSE = [
  { u: 8.3, lat: 14, lon: 228 },
  { u: 8.5, lat: -8, lon: 282 },
  { u: 9, lat: -10, lon: 288 },
];

export async function buildGlobe({ group, mats, manager, lite }) {
  const spin = new Group(); // rota para poner una lat/lon al frente
  group.add(spin);

  spin.add(new Mesh(new SphereGeometry(R * 0.995, lite ? 40 : 64, lite ? 28 : 44), mats.dark));

  // tierra: un disco por punto, orientado hacia afuera (1 draw call)
  const buf = await new FileLoader(manager).setResponseType('arraybuffer').loadAsync('/assets/data/globo-puntos.bin');
  const ll = new Int16Array(buf);
  const n = ll.length / 2;
  const dots = new InstancedMesh(new CircleGeometry(0.06, 6), new MeshBasicMaterial({ color: 0x9d968f }), n);
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const s = new Vector3(1, 1, 1);
  const Z = new Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    latLon(ll[i * 2] / 100, ll[i * 2 + 1] / 100, R * 1.002, v);
    q.setFromUnitVectors(Z, v.clone().normalize());
    dots.setMatrixAt(i, m.compose(v, q, s));
  }
  dots.name = 'globo-tierra';
  spin.add(dots);

  // pines: oficinas en China + destinos (1 draw call)
  const pins = [...OFFICES, ...LATAM];
  const pinMesh = new InstancedMesh(new CylinderGeometry(0.07, 0.07, 0.5, 8).translate(0, 0.25, 0), mats.glow, pins.length);
  const Y = new Vector3(0, 1, 0);
  pins.forEach(([la, lo], i) => {
    latLon(la, lo, R, v);
    q.setFromUnitVectors(Y, v.clone().normalize());
    pinMesh.setMatrixAt(i, m.compose(v, q, s));
  });
  pinMesh.name = 'globo-pines';
  spin.add(pinMesh);

  const routeMat = new MeshBasicMaterial({ color: 0xfbae17 });
  const main = new Mesh(routeGeometry(MAIN_ROUTE, 0.07, 220), routeMat);
  const branchMat = new MeshBasicMaterial({ color: 0xd9d2ca });
  const branches = BRANCHES.map((w) => new Mesh(routeGeometry(w, 0.03, 90), branchMat));
  spin.add(main, ...branches);
  reveal(main, 0);
  branches.forEach((b) => reveal(b, 0));

  let introStart = null;
  let fit = 1; // escala para que el globo entre en el hueco libre de la pantalla (la calcula Stage)
  return {
    setFit(s) {
      fit = s;
    },
    update(u, time) {
      const closing = u >= 8;
      // en la zambullida vuelve a tamaño real para que la cámara "entre" a China
      spin.scale.setScalar(closing ? fit : fit + (1 - fit) * smooth(0.55, 0.95, u));
      const keys = closing ? FOCUS_CLOSE : FOCUS_OPEN;
      const lat = keyframes(keys, u, 'lat');
      const lon = keyframes(keys, u, 'lon') + (closing ? 0 : Math.sin(time * 0.15) * 2.5 * (1 - smooth(0.4, 0.8, u)));
      spin.rotation.set(lat * D2R, -lon * D2R, 0, 'XYZ');

      if (introStart === null) introStart = time;
      // la ruta principal se dibuja sola al entrar; en el cierre ya está completa
      reveal(main, closing ? 1 : (time - introStart - 0.5) / 2.6);
      branches.forEach((b, i) => reveal(b, closing ? smooth(8.32 + i * 0.03, 8.47 + i * 0.03, u) : 0));
    },
  };
}
