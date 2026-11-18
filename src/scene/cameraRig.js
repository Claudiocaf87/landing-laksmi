import { CatmullRomCurve3, Vector3 } from 'three';
import { CLOSE_START } from './globe.js';

// Cámara del globo. u está en "unidades de etapa" de la timeline maestra:
// Dos estados de cámara para el mismo globo:
// hero = 0 … 1 (se acerca apenas mientras el globo gira de China a América) · cierre = CLOSE_START … 10 (se aleja).
// En ambos la estación queda a 41 m: el hero termina en el mismo encuadre que el cierre.
const HERO = [
  { u: 0.0, p: [0, 3, 44], l: [0, 0.4, 0] },
  { u: 0.6, p: [0, 2, 41], l: [0, 0, 0] },
  { u: 1.0, p: [0, 2, 41], l: [0, 0, 0] },
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
