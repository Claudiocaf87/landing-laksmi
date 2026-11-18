import { Group, Mesh } from 'three';
import { Batch } from '../batch.js';
import { createTruck, crateGeometry, instanced, lerp, smooth } from '../common.js';
import { CHASSIS_Y, DECK_SLOT_Y, LANE_Z, SHIP_Z, TRUCK_TO_BOX, buildHarbor, heroContainer } from './harbor.js';

// SET D · Puerto de origen (etapa 04). Andén del depósito en x ≈ -70 → camión por el carril z = 11
// → grúa en x = 0 → buque en z = -14. Sub-estados: "Cargado y precintado" y "Embarcado".
const DOCK_X = -66.43; // borde del andén = puertas del contenedor
export const BOX_START_X = DOCK_X + 3.03; // centro del contenedor en el andén

export function buildPort({ group, mats }) {
  const b = new Batch();
  const { trolley } = buildHarbor(b, group, mats, {
    cranesX: [0, -40, 40],
    yard: [
      { x: -30, z: 36, bays: 10, rows: 7, tiers: 4, fill: 0.55 },
      { x: -30, z: 62, bays: 10, rows: 5, tiers: 3, fill: 0.4 },
    ],
  });
  // depósito con andén de carga
  b.box('concrete', 40, 12, 0.4, -90, 6, -0.2 + 30); // fondo
  b.box('concrete', 40, 0.4, 30, -90, 12, 15); // techo
  b.box('concrete', 40, 12, 0.4, -90, 6, 0.2);
  b.box('concrete', 0.4, 12, 7.8, -70, 6, 4.1); // frente, a los lados del portón (z 8 … 14)
  b.box('concrete', 0.4, 12, 16, -70, 6, 22);
  b.box('concrete', 0.4, 12 - 4.6, 6, -70, 4.6 + (12 - 4.6) / 2, 11);
  b.box('mid', 3.6, CHASSIS_Y, 12, DOCK_X - 1.8, CHASSIS_Y / 2, 11); // andén
  b.box('ground', 20, CHASSIS_Y, 28, -80, CHASSIS_Y / 2, 15); // piso del depósito
  for (const dz of [-4, 4]) b.box('dark', 0.3, 0.4, 0.3, DOCK_X + 0.15, CHASSIS_Y - 0.2, 11 + dz); // topes
  b.box('emissive', 3, 0.1, 0.6, -70.4, 5.2, 11);
  b.flush(group, mats);

  const truck = createTruck(mats);
  group.add(truck);
  const box = heroContainer(mats, mats.mid);
  group.add(box);

  // pallet con cajas que entra al contenedor; la caja protagonista va arriba
  const pallet = new Group();
  const crateGeo = crateGeometry();
  pallet.add(new Mesh(crateGeo.clone().scale(1.2 / 0.45, 0.15 / 0.32, 1.2 / 0.35), mats.wood));
  const crates = [];
  for (let l = 0; l < 3; l++) for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 3; iz++) crates.push({ x: -0.25 + ix * 0.5, y: 0.15 + l * 0.33, z: -0.38 + iz * 0.38 });
  pallet.add(instanced(crateGeo, mats.box, crates, { name: 'pallet' }));
  const hero = new Mesh(crateGeo, mats.hero);
  hero.position.set(0, 0.15 + 3 * 0.33, 0);
  pallet.add(hero);
  group.add(pallet);

  return {
    update(u) {
      // 4,00 → 4,17  el pallet entra al contenedor
      const pIn = smooth(4.0, 4.17, u);
      pallet.position.set(lerp(DOCK_X - 2.3, DOCK_X + 2.2, pIn), CHASSIS_Y + 0.06, LANE_Z);
      pallet.visible = u < 4.32;
      // 4,17 → 4,26 puertas · 4,25 → 4,30 precinto
      box.setDoors(1 - smooth(4.17, 4.26, u));
      box.userData.seal.scale.setScalar(Math.max(0.001, smooth(4.25, 4.3, u)));

      // 4,30 → 4,52 el camión va hasta la grúa
      const truckX = lerp(BOX_START_X - TRUCK_TO_BOX, -TRUCK_TO_BOX, smooth(4.3, 4.52, u));
      truck.position.set(truckX, 0, LANE_Z);

      // grúa: baja el spreader (4,52) → levanta (4,57) → carro al mar (4,64) → apoya en cubierta (4,71 → 4,77)
      const onTruckTop = CHASSIS_Y + 2.59;
      const high = 26;
      const deckTop = DECK_SLOT_Y + 2.59;
      let z = LANE_Z;
      let top = high;
      if (u < 4.52) top = high;
      else if (u < 4.57) top = lerp(high, onTruckTop, smooth(4.52, 4.57, u));
      else if (u < 4.64) top = lerp(onTruckTop, high, smooth(4.57, 4.64, u));
      else if (u < 4.71) z = lerp(LANE_Z, SHIP_Z, smooth(4.64, 4.71, u));
      else if (u < 4.79) {
        z = SHIP_Z;
        top = lerp(high, deckTop, smooth(4.71, 4.77, u));
      } else {
        z = SHIP_Z;
        top = lerp(deckTop, high, smooth(4.8, 4.92, u));
      }
      if (u >= 4.64 && u < 4.71) top = high;
      trolley.setLoad(z, top);

      const lifted = u >= 4.57;
      if (!lifted) box.position.set(truckX + TRUCK_TO_BOX, CHASSIS_Y, LANE_Z);
      else if (u < 4.79) box.position.set(0, top - 2.59, z);
      else box.position.set(0, DECK_SLOT_Y, SHIP_Z);
    },
  };
}
