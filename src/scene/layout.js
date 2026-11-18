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

// Fondo de cada set: clave alta (crema en interiores, cielo claro en exteriores).
export const SET_BACKGROUND = {
  globe: 0xf7f3ee,
  plan: 0xf7f3ee,
  china: 0xf3eee7,
  port: 0xdfe8f0,
  ocean: 0xf1dcae,
  dest: 0xdfe8f0,
};
