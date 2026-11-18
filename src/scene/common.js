// Utilidades compartidas por el globo.
// PALETTE replica los tokens de CSS: el azul es provisional hasta que llegue el hex real del cliente.
export const PALETTE = {
  gold: 0xc9a24a,
  goldDeep: 0x8a6100,
  blue: 0x0e2a47,
  cream: 0xf7f3ee,
};

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

// Interpola una lista de claves [{u, ...valores}] para un u dado.
export function keyframes(keys, u, field) {
  if (u <= keys[0].u) return keys[0][field];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (u <= b.u) return lerp(a[field], b[field], smooth(a.u, b.u, u));
  }
  return keys[keys.length - 1][field];
}
