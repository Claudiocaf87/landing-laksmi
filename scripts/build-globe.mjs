// Genera public/assets/data/globo-puntos.bin: puntos distribuidos uniformemente sobre la esfera
// (espiral de Fibonacci) que caen sobre tierra firme según Natural Earth 1:110m (dominio público).
// Formato: Int16 pares [lat*100, lon*100]. Se corre una sola vez: npm run globo
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);

const N = Number(process.argv[2] || 22000);
const golden = Math.PI * (3 - Math.sqrt(5));
const out = [];
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const lat = (Math.asin(y) * 180) / Math.PI;
  let lon = (((i * golden) % (2 * Math.PI)) * 180) / Math.PI;
  if (lon > 180) lon -= 360;
  if (lat < -60) continue; // sin Antártida: limpia la vista y ahorra puntos
  if (geoContains(land, [lon, lat])) out.push(Math.round(lat * 100), Math.round(lon * 100));
}
const buf = Buffer.from(new Int16Array(out).buffer);
mkdirSync(new URL('../public/assets/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/assets/data/globo-puntos.bin', import.meta.url), buf);
console.log(`${out.length / 2} puntos · ${(buf.length / 1024).toFixed(1)} KB`);
