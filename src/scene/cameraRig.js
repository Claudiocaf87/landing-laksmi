import { CatmullRomCurve3, Vector3 } from 'three';
import { CLOSE_START } from './globe.js';

// Cámara del globo. u está en "unidades de etapa" de la timeline maestra:
// hero = 0 … 1 (gira, dibuja la ruta y se zambulle hacia China) · cierre = CLOSE_START … 10 (se aleja).
// p = posición, l = punto de mira. Dos tramos independientes: entre ellos el globo no se dibuja.
const HERO = [
  { u: 0.0, p: [0, 3, 44], l: [0, 0.6, 0] },
  { u: 0.5, p: [0, 2.6, 41], l: [0, 0.4, 0] },
  { u: 0.8, p: [0, 1.4, 22], l: [0, 0.1, 0] },
  { u: 0.99, p: [0, 0.6, 12.4], l: [0, 0, 0] },
];
const CLOSE = [
  { u: CLOSE_START, p: [0, 1.5, 30], l: [0, 0, 0] },
  { u: CLOSE_START + 0.15, p: [0, 2, 41], l: [0, 0, 0] },
  { u: 10, p: [0, 2.6, 43], l: [0, 0, 0] },
];

function segment(keys) {
  return {
    keys,
    pos: new CatmullRomCurve3(keys.map((k) => new Vector3(...k.p)), false, 'centripetal'),
    look: new CatmullRomCurve3(keys.map((k) => new Vector3(...k.l)), false, 'centripetal'),
  };
}

export class CameraRig {
  constructor() {
    this.hero = segment(HERO);
    this.close = segment(CLOSE);
    this._p = new Vector3();
    this._l = new Vector3();
  }

  apply(camera, u) {
    const seg = u >= CLOSE_START - 0.05 ? this.close : this.hero;
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
