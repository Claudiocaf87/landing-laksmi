import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { CONTAINER_GREYS, buildCrane, createHeroContainer, createShip, createTrolley, crateGeometry, instanced, stack, unitBox } from '../common.js';

// Base compartida por el puerto de origen (etapa 04) y el de destino (etapa 06):
// muelle en y = 0 para z ≥ 0, agua para z < 0, buque atracado en z = -14 y grúa principal en x = 0.
// El carril de camiones pasa por z = 11 (bajo el pórtico de la grúa).
export const LANE_Z = 11;
export const SHIP_Z = -14;
export const CHASSIS_Y = 1.33; // altura del chasis = altura del andén
export const TRUCK_TO_BOX = -7.6; // centro del contenedor respecto del frente del camión
export const DECK_SLOT_Y = 7 + 2.59 * 4; // base del contenedor protagonista sobre la carga del buque

export function buildHarbor(b, group, mats, { yardSeed = 5, cranesX = [0, -40, 40], yard = [] } = {}) {
  b.box('ground', 420, 0.2, 140, 0, -0.1, 70);
  b.box('concrete', 420, 2.2, 1.2, 0, -1.1, 0.6); // borde del muelle
  for (let x = -200; x <= 200; x += 12) b.box('dark', 0.5, 0.5, 0.5, x, 0.25, 1.2); // bitas
  for (const x of cranesX) buildCrane(b, x);
  const water = new Mesh(new PlaneGeometry(900, 500).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: 0x3c4245, roughness: 0.35 }));
  water.position.set(0, -2, -250);
  water.name = 'agua';
  group.add(water);

  const items = [];
  for (const y of yard) stack(items, { ...y, seed: yardSeed++ });
  if (items.length) group.add(instanced(unitBox, mats.container, items, { colors: CONTAINER_GREYS, name: 'patio' }));

  const ship = createShip(mats, { seed: yardSeed + 11 });
  ship.position.set(0, 0, SHIP_Z);
  group.add(ship);

  const trolley = createTrolley(mats);
  group.add(trolley);
  return { ship, trolley, water };
}

// Contenedor protagonista con carga adentro (visible por la puerta y en la vista rayos X).
export function heroContainer(mats, shellMat) {
  const c = createHeroContainer(shellMat, mats.dark);
  const crates = [];
  for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 4; iz++) for (let l = 0; l < 3; l++) crates.push({ x: 2.6 - ix * 0.48, y: 0.06 + l * 0.33, z: -0.9 + iz * 0.6 });
  const cargo = instanced(crateGeometry(), mats.box, crates, { name: 'carga-contenedor' });
  c.add(cargo);
  c.userData.cargo = cargo;
  return c;
}
