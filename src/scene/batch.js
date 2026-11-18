import { BoxGeometry, CylinderGeometry, Euler, Matrix4, Mesh, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Acumula geometría estática agrupada por material y la fusiona en un solo mesh por material.
// Así todo el escenario fijo cuesta un draw call por material en vez de uno por objeto.
export class Batch {
  constructor() {
    this.buckets = new Map();
    this._m = new Matrix4();
    this._q = new Quaternion();
    this._e = new Euler();
    this._p = new Vector3();
    this._s = new Vector3();
  }

  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this._e.set(rx, ry, rz);
    this._q.setFromEuler(this._e);
    this._p.set(x, y, z);
    this._s.set(sx, sy, sz);
    geo.applyMatrix4(this._m.compose(this._p, this._q, this._s));
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(geo);
    return geo;
  }

  box(key, w, h, d, x, y, z, ry = 0) {
    return this.add(new BoxGeometry(w, h, d), key, x, y, z, 0, ry, 0);
  }

  cyl(key, r, h, x, y, z, rx = 0, rz = 0, seg = 14) {
    return this.add(new CylinderGeometry(r, r, h, seg), key, x, y, z, rx, 0, rz);
  }

  plane(key, w, h, x, y, z, ry = 0) {
    return this.add(new PlaneGeometry(w, h), key, x, y, z, 0, ry, 0);
  }

  sphere(key, r, x, y, z, sx = 1, sy = 1, sz = 1) {
    return this.add(new SphereGeometry(r, 14, 10), key, x, y, z, 0, 0, 0, sx, sy, sz);
  }

  flush(parent, materials) {
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new Mesh(merged, materials[key]);
      mesh.name = `estatico:${key}`;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

// Pared con un vano centrado (o sin vano si openW = 0). z es el centro del espesor.
export function wall(b, key, z, halfW, h, openW, openH, t = 0.3) {
  if (openW <= 0) {
    b.box(key, halfW * 2, h, t, 0, h / 2, z);
    return;
  }
  const sideW = halfW - openW / 2;
  b.box(key, sideW, h, t, -(openW / 2 + sideW / 2), h / 2, z);
  b.box(key, sideW, h, t, openW / 2 + sideW / 2, h / 2, z);
  if (h > openH) b.box(key, openW, h - openH, t, 0, openH + (h - openH) / 2, z);
}

// Piso, techo y paredes laterales de un ambiente que va de zNear a zFar (zFar < zNear).
export function room(b, { hw, zNear, zFar, h, floor = 'floor', walls = 'concrete', ceiling = 'dark' }) {
  const len = zNear - zFar;
  const zc = (zNear + zFar) / 2;
  b.box(floor, hw * 2, 0.1, len, 0, -0.05, zc);
  b.box(ceiling, hw * 2, 0.1, len, 0, h + 0.05, zc);
  b.box(walls, 0.2, h, len, -hw - 0.1, h / 2, zc);
  b.box(walls, 0.2, h, len, hw + 0.1, h / 2, zc);
}
