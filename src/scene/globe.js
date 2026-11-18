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
import { content } from '../content/index.js';
import { PALETTE, clamp01 } from './common.js';

// Globo (hero = etapa 00 y cierre = etapa 09). Radio 10. Claro, con puntos dorados.
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
// longitudes "desenrolladas" de forma continua: cada punto queda a menos de 180° del anterior,
// así una ruta nunca da la vuelta al mundo por el lado equivocado (Pacífico o Atlántico)
const unwrap = (route) => {
  let prev = null;
  return route.map(([la, lo]) => {
    let l = lo;
    if (prev !== null) {
      while (l - prev > 180) l -= 360;
      while (l - prev < -180) l += 360;
    }
    prev = l;
    return [la, l];
  });
};

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

// Un solo globo con dos estados de encuadre: CHINA (las 4 oficinas) y AMERICA (todas las rutas que
// llegan a Latinoamérica, el mismo encuadre del cierre). El hero va de uno al otro hacia el este,
// cruzando el Pacífico, mientras se dibujan las rutas.
export const CHINA_START = { lat: 30, lon: 104 }; // arranque de la animación de entrada
export const CHINA = { lat: 24, lon: 128 }; // reposo del hero: las 4 oficinas y la ruta saliendo hacia el este
export const AMERICA = { lat: 4, lon: 292 };
export const CLOSE_START = 9.32; // el globo del cierre aparece después de la foto final
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export async function buildGlobe({ group, manager, lite = false, fast = false }) {
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
  const otherRoutes = others.filter((o) => o.ruta?.length > 1).map((o) => new Mesh(routeGeometry(unwrap(o.ruta), 0.04, 140, 0.042), otherMat));
  const branchMat = new MeshBasicMaterial({ color: PALETTE.blue });
  const branches = BRANCHES.map((w) => new Mesh(routeGeometry(w, 0.03, 90, 0.035), branchMat));
  spin.add(main, ...otherRoutes, ...branches);
  [main, ...otherRoutes, ...branches].forEach((r) => reveal(r, 0));

  let introStart = null;
  const INTRO_S = fast ? 1.8 : 2.4; // duración de la animación de entrada (s)
  const HERO_END = fast ? 0.55 : 0.75; // u en el que el giro hacia América termina con scroll
  const FIRST_LEG = 0.3; // tramo de la ruta principal que dibuja la entrada (sale de China hacia el este)
  let fit = 1; // escala para que el globo entre en el hueco libre de la pantalla (la calcula Stage)
  return {
    setFit(f) {
      fit = f;
    },
    // Dos partes: la entrada (solo tiempo) acomoda China y dibuja el primer tramo de la ruta;
    // el giro China → América (0 … 1) lo hace solo el scroll, completo en HERO_END.
    intro(time) {
      if (introStart === null) introStart = time;
      return ease(clamp01((time - introStart - 0.4) / INTRO_S));
    },
    progress(u) {
      return u >= 9 ? 1 : ease(clamp01(u / HERO_END));
    },
    heroEnd: HERO_END,
    update(u, time) {
      spin.scale.setScalar(fit);
      const k = u >= 9 ? 1 : this.intro(time);
      const p = this.progress(u);
      const lat0 = CHINA_START.lat + (CHINA.lat - CHINA_START.lat) * k;
      const lon0 = CHINA_START.lon + (CHINA.lon - CHINA_START.lon) * k;
      const lat = lat0 + (AMERICA.lat - lat0) * p;
      const lon = lon0 + (AMERICA.lon - lon0) * p;
      spin.rotation.set(lat * D2R, -lon * D2R, 0, 'XYZ');
      // rutas: la entrada dibuja el primer tramo; el resto se dibuja mientras gira con el scroll
      reveal(main, Math.max(FIRST_LEG * k, FIRST_LEG + (1 - FIRST_LEG) * (p / 0.8)));
      otherRoutes.forEach((r) => reveal(r, (p - 0.55) / 0.4));
      branches.forEach((b, i) => reveal(b, (p - 0.68 - i * 0.04) / 0.25));
    },
  };
}
