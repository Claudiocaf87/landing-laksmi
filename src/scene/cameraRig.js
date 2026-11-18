import { CatmullRomCurve3, Vector3 } from 'three';
import { SET_OFFSETS } from './layout.js';

// Recorrido de cámara. u está en "unidades de etapa": 0 = inicio de la 00 … 9 = fin de la 08.
// Cada etapa tiene su estación en u = i + 0,5 (el texto está fijo y la cámara casi quieta).
// s = set (cada uno vive en su propia zona del mundo), p = posición, l = punto de mira,
// en coordenadas locales del set. Al cambiar de set hay un corte, tapado con un fundido (veil).
export const CAMERA_KEYS = [
  // 00 · globo
  { u: 0.0, s: 'globe', p: [0, 3, 44], l: [0, 0.6, 0] },
  { u: 0.5, s: 'globe', p: [0, 2.6, 41], l: [0, 0.4, 0] },
  { u: 0.8, s: 'globe', p: [0, 1.4, 22], l: [0, 0.1, 0] },
  { u: 0.99, s: 'globe', p: [0, 0.6, 12.4], l: [0, 0, 0] },
  // 01 · mesa del plan (entra desde arriba, como si siguiera la zambullida)
  { u: 1.0, s: 'plan', p: [0.05, 3.1, 0.18], l: [0.05, 0.75, 0.05] },
  { u: 1.25, s: 'plan', p: [0.45, 2.0, 1.05], l: [0.05, 0.8, 0.0] },
  { u: 1.5, s: 'plan', p: [0.9, 1.38, 1.2], l: [0.02, 0.85, 0.0] },
  { u: 1.75, s: 'plan', p: [0.6, 1.16, 0.78], l: [0.05, 0.88, 0.05] },
  { u: 1.99, s: 'plan', p: [0.32, 1.06, 0.52], l: [0.05, 0.92, 0.05] },
  // 02 · showroom → planta
  { u: 2.0, s: 'china', p: [0, 1.7, 4.5], l: [0, 1.6, -10] },
  { u: 2.22, s: 'china', p: [0.4, 1.65, -8], l: [-1, 1.4, -20] },
  { u: 2.4, s: 'china', p: [0, 1.85, -22], l: [1, 1.6, -34] },
  { u: 2.55, s: 'china', p: [-3.5, 4.4, -36], l: [3, 1.2, -48] },
  { u: 2.8, s: 'china', p: [-1.5, 3.6, -54], l: [3, 1, -62] },
  // 03 · control de calidad
  { u: 3.0, s: 'china', p: [-1.2, 2.8, -66], l: [0, 1.1, -76] },
  { u: 3.25, s: 'china', p: [2.4, 2.3, -72.8], l: [0, 1, -76] },
  { u: 3.5, s: 'china', p: [1.5, 1.95, -73.9], l: [0, 0.95, -76] },
  { u: 3.75, s: 'china', p: [0.6, 1.65, -74.6], l: [0, 1.05, -76] },
  { u: 3.99, s: 'china', p: [-1.6, 2.2, -73.5], l: [0, 1, -76] },
  // 04 · carga, precinto, camión, grúa, buque
  { u: 4.0, s: 'port', p: [-60.9, 3.45, 11.5], l: [-68, 2.4, 11] },
  { u: 4.1, s: 'port', p: [-62.8, 3.45, 11.4], l: [-70, 2.4, 12] },
  { u: 4.14, s: 'port', p: [-65.6, 3.3, 11.8], l: [-66, 2.5, 18] },
  { u: 4.19, s: 'port', p: [-69.3, 3.2, 14.2], l: [-63.5, 2.6, 10.6] },
  { u: 4.25, s: 'port', p: [-69.4, 3.3, 15.2], l: [-64.8, 2.4, 11] },
  { u: 4.31, s: 'port', p: [-69.2, 3.4, 15.8], l: [-65.6, 2.4, 11] },
  { u: 4.38, s: 'port', p: [-60, 12, 40], l: [-45, 3, 11] },
  { u: 4.5, s: 'port', p: [-52, 34, 72], l: [-12, 4, 10] },
  { u: 4.6, s: 'port', p: [26, 16, 40], l: [0, 14, 6] },
  { u: 4.7, s: 'port', p: [34, 30, 24], l: [0, 22, -6] },
  { u: 4.82, s: 'port', p: [40, 30, -46], l: [0, 14, -14] },
  { u: 4.99, s: 'port', p: [80, 46, -80], l: [0, 6, -14] },
  // 05 · océano
  { u: 5.0, s: 'ocean', p: [-110, 14, 50], l: [-30, 8, 0] },
  { u: 5.25, s: 'ocean', p: [-60, 22, 70], l: [-15, 8, 0] },
  { u: 5.5, s: 'ocean', p: [-70, 50, 175], l: [0, 4, 0] },
  { u: 5.75, s: 'ocean', p: [50, 22, 70], l: [10, 8, 0] },
  { u: 5.99, s: 'ocean', p: [90, 14, 30], l: [20, 8, 0] },
  // 06 · descarga y aduana (rayos X en la estación)
  { u: 6.0, s: 'dest', p: [34, 34, -40], l: [0, 20, -14] },
  { u: 6.12, s: 'dest', p: [30, 22, 34], l: [0, 14, 0] },
  { u: 6.24, s: 'dest', p: [26, 8, 32], l: [2, 3, 11] },
  { u: 6.36, s: 'dest', p: [30, 6, 30], l: [30, 3, 11] },
  { u: 6.5, s: 'dest', p: [50, 5.8, 20], l: [40, 2.2, 11] },
  { u: 6.64, s: 'dest', p: [52, 6.5, 23], l: [42, 2.6, 11] },
  { u: 6.85, s: 'dest', p: [60, 9, 30], l: [72, 3, 11] },
  // 07 · ruta y entrega
  { u: 7.0, s: 'dest', p: [80, 10, 28], l: [95, 3, 11] },
  { u: 7.2, s: 'dest', p: [112, 8, 1], l: [124, 3, 11] },
  { u: 7.4, s: 'dest', p: [150, 6, -2], l: [160, 3, 14] },
  { u: 7.55, s: 'dest', p: [146, 7, -7], l: [164, 2.6, 18] },
  { u: 7.75, s: 'dest', p: [161, 2.4, 13.8], l: [165, 1, 19] },
  { u: 7.98, s: 'dest', p: [163.6, 1.7, 15.8], l: [165, 0.5, 18.4] },
  // 08 · se abre la caja → vuelta al globo con todas las rutas
  { u: 8.0, s: 'dest', p: [163.7, 1.65, 15.9], l: [165, 0.5, 18.4] },
  { u: 8.28, s: 'dest', p: [164.1, 1.55, 16.3], l: [165.05, 0.6, 18.4] },
  { u: 8.3, s: 'globe', p: [0, 1.5, 26], l: [0, 0, 0] },
  { u: 8.55, s: 'globe', p: [0, 2, 40], l: [0, 0, 0] },
  { u: 9.0, s: 'globe', p: [0, 2.6, 43], l: [0, 0, 0] },
];

export class CameraRig {
  constructor(keys = CAMERA_KEYS) {
    // segmentos contiguos del mismo set → una curva por segmento
    this.segments = [];
    for (const k of keys) {
      const last = this.segments[this.segments.length - 1];
      if (last && last.set === k.s) last.keys.push(k);
      else this.segments.push({ set: k.s, keys: [k] });
    }
    for (const seg of this.segments) {
      const o = new Vector3(...SET_OFFSETS[seg.set]);
      const pts = (f) => seg.keys.map((k) => new Vector3(...k[f]).add(o));
      if (seg.keys.length === 1) seg.keys.push({ ...seg.keys[0], u: seg.keys[0].u + 1e-3 });
      seg.pos = new CatmullRomCurve3(pts('p'), false, 'centripetal');
      seg.look = new CatmullRomCurve3(pts('l'), false, 'centripetal');
      seg.u0 = seg.keys[0].u;
      seg.u1 = seg.keys[seg.keys.length - 1].u;
    }
    this.cuts = this.segments.slice(1).map((s) => s.u0);
    this._p = new Vector3();
    this._l = new Vector3();
  }

  segmentAt(u) {
    let seg = this.segments[0];
    for (const s of this.segments) if (u >= s.u0) seg = s;
    return seg;
  }

  setAt(u) {
    return this.segmentAt(u).set;
  }

  // distancia (en u) al corte más cercano: sirve para el fundido
  cutDistance(u) {
    let d = Infinity;
    for (const c of this.cuts) d = Math.min(d, Math.abs(u - c));
    return d;
  }

  apply(camera, u) {
    const seg = this.segmentAt(u);
    const k = seg.keys;
    const n = k.length - 1;
    let t;
    if (u <= k[0].u) t = 0;
    else if (u >= k[n].u) t = 1;
    else {
      let i = 0;
      while (i < n - 1 && u > k[i + 1].u) i++;
      t = (i + (u - k[i].u) / (k[i + 1].u - k[i].u)) / n;
    }
    seg.pos.getPoint(t, this._p);
    seg.look.getPoint(t, this._l);
    camera.position.copy(this._p);
    camera.lookAt(this._l);
  }
}
