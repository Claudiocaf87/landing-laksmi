import {
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  FileLoader,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  Color,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { content } from '../../content/index.js';
import { PALETTE, clamp01, keyframes, smooth } from '../common.js';

// SET A · Globo (etapa 00 y cierre). Radio 10. Claro, con puntos dorados.
// Orígenes y destinos salen de es.json → globo (oficina = pin dorado, origen = anillo dorado,
// destino = pin azul; un lugar en las dos listas, como México, lleva pin y anillo).
// Los puntos de tierra salen de public/assets/data/globo-puntos.bin (npm run globo).
export const R = 10;
const D2R = Math.PI / 180;
const G = content.globo;

export function latLon(lat, lon, r = R, v = new Vector3()) {
  const p = lat * D2R;
  const l = lon * D2R;
  return v.set(r * Math.cos(p) * Math.sin(l), r * Math.sin(p), r * Math.cos(p) * Math.cos(l));
}
// longitudes "desenrolladas" (oeste como > 180) para que las rutas que cruzan el Pacífico no salten
const east = (lon) => (lon < 0 ? lon + 360 : lon);

// Ruta principal estilizada desde los puertos de China (no es un trazado de navegación real).
const MAIN_ROUTE = [
  [29.0, 123.5], [30, 140], [27, 162], [22, 188], [16, 215], [11, 245], [7.6, 279], [9.2, 280.3], [10.8, 283], [10.9, 293],
];
// Ramales desde el Pacífico hacia otros destinos.
const BRANCHES = [
  [[16, 215], [17.6, 240], [19.05, 255.7]],
  [[11, 245], [6.5, 268], [3.9, 282.9]],
  [[11, 245], [-3, 266], [-12.05, 282.6]],
  [[11, 245], [-14, 262], [-33.6, 288]],
];

function routeGeometry(waypoints, lift = 0.07, seg = 180, radius = 0.055) {
  const flat = new CatmullRomCurve3(waypoints.map(([la, lo]) => new Vector3(lo, la, 0)), false, 'centripetal');
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const q = flat.getPoint(t);
    pts.push(latLon(q.y, q.x, R * (1.012 + lift * Math.sin(Math.PI * t))));
  }
  const geo = new TubeGeometry(new CatmullRomCurve3(pts), seg, radius, 6, false);
  geo.userData.per = 6 * 6;
  geo.userData.seg = seg;
  return geo;
}
const reveal = (mesh, p) => {
  const { per, seg } = mesh.geometry.userData;
  mesh.geometry.setDrawRange(0, Math.floor(clamp01(p) * seg) * per);
  mesh.visible = p > 0.001;
};

// retícula fina (meridianos y paralelos) en una sola LineSegments
function graticule() {
  const pos = [];
  const v = new Vector3();
  const w = new Vector3();
  const r = R * 1.001;
  for (let lat = -60; lat <= 75; lat += 15)
    for (let lon = 0; lon < 360; lon += 4) pos.push(...latLon(lat, lon, r, v).toArray(), ...latLon(lat, lon + 4, r, w).toArray());
  for (let lon = 0; lon < 360; lon += 20)
    for (let lat = -76; lat < 80; lat += 4) pos.push(...latLon(lat, lon, r, v).toArray(), ...latLon(lat + 4, lon, r, w).toArray());
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return new LineSegments(g, new LineBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.22 }));
}

const FOCUS_OPEN = [
  { u: 0, lat: 24, lon: 197 },
  { u: 0.5, lat: 22, lon: 200 },
  { u: 0.98, lat: 29, lon: 122 },
];
// cierre: entre el Atlántico y el Pacífico para que se vean todas las rutas que llegan a Latinoamérica
const FOCUS_CLOSE = [
  { u: 8.3, lat: 14, lon: 228 },
  { u: 8.5, lat: 4, lon: 292 },
  { u: 9, lat: 0, lon: 296 },
];

export async function buildGlobe({ group, manager, lite }) {
  const spin = new Group();
  group.add(spin);

  spin.add(new Mesh(new SphereGeometry(R * 0.995, lite ? 40 : 64, lite ? 28 : 44), new MeshStandardMaterial({ color: 0xf8f2e8, roughness: 0.8 })));
  spin.add(graticule());
  // halo dorado en el borde (fresnel): separa el globo claro del fondo crema
  const halo = new Mesh(
    new SphereGeometry(R * 1.07, 48, 32),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new Color(PALETTE.gold) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(vN, vV)); float a = smoothstep(0.45, 0.95, f) * (1.0 - smoothstep(0.97, 1.0, f)) * 0.5; gl_FragColor = vec4(uColor, a); }',
    }),
  );
  halo.renderOrder = 2;
  spin.add(halo);

  // tierra: un disco dorado por punto (1 draw call)
  const buf = await new FileLoader(manager).setResponseType('arraybuffer').loadAsync('/assets/data/globo-puntos.bin');
  const ll = new Int16Array(buf);
  const n = ll.length / 2;
  const dots = new InstancedMesh(new CircleGeometry(0.07, 6), new MeshBasicMaterial({ color: 0xa47720 }), n);
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const s = new Vector3(1, 1, 1);
  const Z = new Vector3(0, 0, 1);
  const Y = new Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    latLon(ll[i * 2] / 100, ll[i * 2 + 1] / 100, R * 1.002, v);
    q.setFromUnitVectors(Z, v.clone().normalize());
    dots.setMatrixAt(i, m.compose(v, q, s));
  }
  dots.name = 'globo-tierra';
  spin.add(dots);

  // pines: oficinas (dorado) y destinos (azul) · anillos: otros orígenes
  const place = (mesh, list, axis, r = R) => {
    list.forEach((p, i) => {
      latLon(p.lat, p.lon, r, v);
      q.setFromUnitVectors(axis, v.clone().normalize());
      mesh.setMatrixAt(i, m.compose(v, q, s));
    });
    spin.add(mesh);
  };
  const pinGeo = new CylinderGeometry(0.075, 0.075, 0.55, 10).translate(0, 0.275, 0);
  const offices = G.origenes.filter((o) => o.tipo === 'oficina');
  const others = G.origenes.filter((o) => o.tipo !== 'oficina');
  place(new InstancedMesh(pinGeo, new MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.3 }), offices.length), offices, Y);
  place(new InstancedMesh(pinGeo, new MeshBasicMaterial({ color: PALETTE.blue }), G.destinos.length), G.destinos, Y);
  if (others.length) place(new InstancedMesh(new TorusGeometry(0.26, 0.05, 6, 24), new MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.3 }), others.length), others, Z, R * 1.01);

  // rutas: China → Latinoamérica (dorado), otros orígenes (dorado fino), ramales a destinos (azul)
  const main = new Mesh(routeGeometry(MAIN_ROUTE, 0.07, 220), new MeshBasicMaterial({ color: 0xc9a24a }));
  const otherMat = new MeshBasicMaterial({ color: 0xd8b25a });
  const otherRoutes = others.filter((o) => o.ruta?.length > 1).map((o) => new Mesh(routeGeometry(o.ruta.map(([la, lo]) => [la, east(lo)]), 0.04, 140, 0.042), otherMat));
  const branchMat = new MeshBasicMaterial({ color: PALETTE.blue });
  const branches = BRANCHES.map((w) => new Mesh(routeGeometry(w, 0.03, 90, 0.035), branchMat));
  spin.add(main, ...otherRoutes, ...branches);
  [main, ...otherRoutes, ...branches].forEach((r) => reveal(r, 0));

  let introStart = null;
  let fit = 1; // escala para que el globo entre en el hueco libre de la pantalla (la calcula Stage)
  return {
    setFit(f) {
      fit = f;
    },
    update(u, time) {
      const closing = u >= 8;
      spin.scale.setScalar(closing ? fit : fit + (1 - fit) * smooth(0.55, 0.95, u));
      const keys = closing ? FOCUS_CLOSE : FOCUS_OPEN;
      const lat = keyframes(keys, u, 'lat');
      const lon = keyframes(keys, u, 'lon') + (closing ? 0 : Math.sin(time * 0.15) * 2.5 * (1 - smooth(0.4, 0.8, u)));
      spin.rotation.set(lat * D2R, -lon * D2R, 0, 'XYZ');

      if (introStart === null) introStart = time;
      const intro = closing ? 1 : (time - introStart - 0.5) / 2.6;
      reveal(main, intro);
      otherRoutes.forEach((r) => reveal(r, closing ? 1 : intro - 0.3));
      branches.forEach((b, i) => reveal(b, closing ? smooth(8.32 + i * 0.03, 8.47 + i * 0.03, u) : 0));
    },
  };
}
