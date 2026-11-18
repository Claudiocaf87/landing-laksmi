// Peso del build de producción en gzip, separando JS/CSS/HTML de los assets 3D.
// Uso: npm run build && npm run peso
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist).map((p) => {
  const buf = readFileSync(p);
  return { path: relative(dist, p).replaceAll('\\', '/'), raw: buf.length, gz: gzipSync(buf, { level: 9 }).length };
});
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const groups = {
  'JS': (f) => extname(f.path) === '.js',
  'CSS': (f) => extname(f.path) === '.css',
  'HTML': (f) => extname(f.path) === '.html',
  'Datos del globo': (f) => /^assets\/data\//.test(f.path),
  'Imágenes / video / logo': (f) => /^assets\/(logo|fotos|og|productos|video)\//.test(f.path) && !/\.md$/.test(f.path),
};
for (const [name, test] of Object.entries(groups)) {
  const list = files.filter(test);
  const raw = list.reduce((a, f) => a + f.raw, 0);
  const gz = list.reduce((a, f) => a + f.gz, 0);
  console.log(`\n${name}: ${kb(raw)} (gzip ${kb(gz)})`);
  for (const f of list.sort((a, b) => b.gz - a.gz)) console.log(`  ${f.path.padEnd(46)} ${kb(f.raw).padStart(10)}  gzip ${kb(f.gz).padStart(9)}`);
}
