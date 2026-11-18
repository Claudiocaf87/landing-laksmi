import { DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { Batch } from '../batch.js';
import { createTruck, crateGeometry, cutoutMesh, lerp, silhouetteTexture, smooth, unitBox } from '../common.js';
import { CHASSIS_Y, DECK_SLOT_Y, LANE_Z, SHIP_Z, TRUCK_TO_BOX, buildHarbor, heroContainer } from './harbor.js';

// SET F · Destino (etapas 06, 07 y comienzo de la 08). Puerto de [PUERTO DE DESTINO]:
//   grúa en x = 0 → escáner de aduana en x = 40 → ruta por z = 11 → almacén del cliente en x ≈ 165.
export const SCAN_X = 40;
export const DOOR = { x: 165, z: 20 }; // portón del almacén del cliente (mira hacia -Z)
const PARK_X = 162; // centro del contenedor estacionado

export function buildDest({ group, mats }) {
  const b = new Batch();
  const { trolley } = buildHarbor(b, group, mats, {
    yardSeed: 40,
    cranesX: [0, -40],
    yard: [{ x: -70, z: 36, bays: 8, rows: 6, tiers: 3, fill: 0.5 }],
  });

  // escáner de aduana (pórtico) y caseta
  for (const z of [LANE_Z - 4.2, LANE_Z + 4.2]) b.box('mid', 1, 7, 1.6, SCAN_X, 3.5, z);
  b.box('mid', 3, 1.2, 9.4, SCAN_X, 7.4, LANE_Z);
  b.box('light', 4, 3, 3, SCAN_X + 3, 1.5, LANE_Z + 9);
  b.box('dark', 3.6, 1, 0.1, SCAN_X + 3, 2, LANE_Z + 7.45);

  // ruta y entorno
  b.box('dark', 170, 0.04, 8, 125, 0.02, LANE_Z);
  for (let x = 46; x < 210; x += 8) b.box('light', 3, 0.05, 0.2, x, 0.04, LANE_Z);
  for (let i = 0; i < 7; i++) {
    const x = 70 + i * 13;
    b.box(i % 2 ? 'concrete' : 'mid', 9, 5 + (i % 3) * 2.5, 10, x, (5 + (i % 3) * 2.5) / 2, LANE_Z + 13);
    b.box('mid', 8, 4 + (i % 2) * 3, 9, x + 4, (4 + (i % 2) * 3) / 2, LANE_Z - 13);
  }
  // almacén del cliente con portón enrollable
  const bx = DOOR.x;
  const bz = DOOR.z;
  b.box('concrete', 10.4, 7, 0.3, bx - 7.2, 3.5, bz); // frente izq.
  b.box('concrete', 10.4, 7, 0.3, bx + 7.2, 3.5, bz); // frente der.
  b.box('concrete', 4, 2.5, 0.3, bx, 5.75, bz); // dintel
  b.box('concrete', 24.8, 0.3, 16, bx, 7.15, bz + 8);
  b.box('concrete', 0.3, 7, 16, bx - 12.4, 3.5, bz + 8);
  b.box('concrete', 0.3, 7, 16, bx + 12.4, 3.5, bz + 8);
  b.box('concrete', 24.8, 7, 0.3, bx, 3.5, bz + 16);
  b.box('ground', 24.4, 0.06, 15.6, bx, 0.03, bz + 8);
  b.box('dark', 7, 1.2, 0.12, bx - 6, 5.6, bz - 0.2); // cartel (hueco para logo del cliente)
  b.box('mid', 6, 0.15, 3, bx, 0.075, bz - 1.5); // rampa
  for (let i = 0; i < 4; i++) for (let l = 0; l < 3; l++) b.box('box', 1.1, 0.9, 1.1, bx - 4 + i * 2.2, 0.45 + l * 0.92, bz + 12);
  b.flush(group, mats);

  // portón enrollable: sube en 7,42 → 7,56
  const door = new Mesh(unitBox, mats.light);
  door.scale.set(4, 4.5, 0.12);
  group.add(door);

  const truck = createTruck(mats);
  group.add(truck);
  // contenedor con material propio: se vuelve translúcido en el escáner (rayos X)
  const shellMat = new MeshStandardMaterial({ color: 0x77716c, roughness: 0.75, transparent: true, opacity: 1 });
  const box = heroContainer(mats, shellMat);
  group.add(box);
  const beam = new Mesh(new PlaneGeometry(9, 6.6), new MeshBasicMaterial({ color: 0xfbae17, transparent: true, opacity: 0.35, side: DoubleSide, depthWrite: false }));
  beam.rotation.y = Math.PI / 2;
  group.add(beam);

  // entrega: la caja frente al portón y la persona (foto recortada en la fase 4)
  const crate = new Group();
  crate.position.set(DOOR.x, 0, DOOR.z - 1.6);
  crate.rotation.y = 0.25;
  crate.add(new Mesh(crateGeometry(), mats.hero));
  group.add(crate);
  const flaps = [-1, 1].map((s) => {
    const f = new Mesh(unitBox, mats.hero);
    f.scale.set(0.225, 0.006, 0.35);
    crate.add(f);
    return { f, s };
  });
  const person = cutoutMesh(silhouetteTexture(), 0.9, 1.8);
  person.position.set(DOOR.x + 0.85, 0, DOOR.z - 1.25);
  person.rotation.y = Math.PI + 0.35;
  group.add(person);

  return {
    update(u) {
      // --- descarga: 6,00 → 6,26 ---
      const onTruckTop = CHASSIS_Y + 2.59;
      const high = 26;
      const deckTop = DECK_SLOT_Y + 2.59;
      let z = SHIP_Z;
      let top;
      if (u < 6.08) top = lerp(deckTop, high, smooth(6.0, 6.08, u));
      else if (u < 6.16) {
        top = high;
        z = lerp(SHIP_Z, LANE_Z, smooth(6.08, 6.16, u));
      } else {
        z = LANE_Z;
        top = u < 6.24 ? lerp(high, onTruckTop, smooth(6.16, 6.24, u)) : lerp(onTruckTop, high, smooth(6.25, 6.32, u));
      }
      trolley.setLoad(z, top);

      // --- camión: grúa → escáner (6,27 → 6,42) → sale (6,7 → 7,0) → almacén (7,0 → 7,45) ---
      let cx = 0;
      if (u < 6.42) cx = lerp(0, SCAN_X, smooth(6.27, 6.42, u));
      else if (u < 7) cx = lerp(SCAN_X, 78, smooth(6.7, 7.0, u));
      else cx = lerp(78, PARK_X, smooth(7.0, 7.45, u));
      truck.position.set(cx - TRUCK_TO_BOX, 0, LANE_Z);
      if (u < 6.24) box.position.set(0, top - 2.59, z);
      else box.position.set(cx, CHASSIS_Y, LANE_Z);
      box.setDoors(0);

      // --- rayos X: 6,40 → 6,50 se vuelve translúcido · haz 6,42 → 6,62 · vuelve 6,62 → 6,7 ---
      const xr = smooth(6.4, 6.5, u) * (1 - smooth(6.62, 6.7, u));
      shellMat.opacity = 1 - xr * 0.86;
      shellMat.depthWrite = xr < 0.05;
      box.userData.cargo.visible = xr > 0.02 || u < 6.0;
      beam.visible = u > 6.41 && u < 6.64;
      beam.position.set(lerp(SCAN_X - 3.2, SCAN_X + 3.2, smooth(6.42, 6.62, u)), 3.3, LANE_Z);

      // --- portón y entrega ---
      const open = smooth(7.42, 7.56, u);
      door.position.set(DOOR.x, 2.25 + open * 2.4, DOOR.z - 0.05);
      door.scale.y = 4.5 * (1 - open * 0.9);
      crate.visible = person.visible = u > 7.5;
      // la caja se abre en la etapa 08 (8,04 → 8,2)
      const a = smooth(8.04, 8.2, u) * Math.PI * 0.7;
      // tapa: arranca cerrada (horizontal, hacia adentro) y gira hacia afuera sobre la bisagra del borde
      for (const { f, s } of flaps) {
        f.position.set(s * (0.225 - Math.cos(a) * 0.1125), 0.32 + Math.sin(a) * 0.1125, 0);
        f.rotation.z = -s * a;
      }
    },
  };
}
