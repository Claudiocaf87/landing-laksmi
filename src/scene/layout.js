// Cada set vive en su propia zona del mundo (separados 1 km para que nunca se vean entre sí).
// Solo se dibuja el set activo; el cambio de set ocurre en un corte tapado por un fundido.
export const SET_OFFSETS = {
  globe: [0, 0, 0],
  plan: [1000, 0, 0],
  china: [2000, 0, 0],
  port: [3000, 0, 0],
  ocean: [4000, 0, 0],
  dest: [5000, 0, 0],
};

// Color de fondo de cada set (escena gris; en la fase 3 se reemplaza por cielo/ambiente).
export const SET_BACKGROUND = {
  globe: 0x15110f,
  plan: 0x2b2725,
  china: 0x2b2725,
  port: 0x8c8986,
  ocean: 0x8c8986,
  dest: 0x8c8986,
};
