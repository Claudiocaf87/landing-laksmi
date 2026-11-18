import { content, endBlock, etapa, lowEnd, mapU, N_GLOBAL, picture, loadPicture, portrait, reduced, saveData, setupScroll, syncPasos, textBlock, versionBar } from './comun.js';

// Versión B · Zoom a través con profundidad 2.5D (WebGL puro, sin Three.js).
// La cámara "entra" en cada foto con un acercamiento que se acelera hacia su punto de fuga; la foto
// siguiente aparece desde ese punto como una puerta que se abre. Un mapa de profundidad por foto
// (Depth Anything V2, ver scripts/profundidad.py) hace que el primer plano se agrande más que el fondo.
const IDS = ['ferias', 'negociacion', 'calidad'];
const photos = [];
IDS.forEach((id) => {
  const { e, i } = etapa(id);
  e.fotos.forEach((f) => photos.push({ f, gi: i }));
});
const P = photos.length;
const U_POINTS = [
  [0, 2.05],
  [1, 2.4],
  [2, 2.72],
  [2.55, 3.0],
  [3, 3.3],
  [3.45, 3.6],
  [3.6, 4.0],
  [4, 4.4],
];
const pct = (s) => s.split(' ').map((v) => parseFloat(v) / 100);

const main = document.getElementById('contenido');
main.innerHTML = `
<section class="pb" style="--n:${P}">
  <div class="pb__view">
    <canvas class="pb__canvas" aria-hidden="true"></canvas>
    <div class="pb__stack">${photos.map((p, j) => `<figure class="pb__img" data-j="${j}">${picture(content.imagenes.base + p.f.id, { alt: p.f.alt, focal: p.f.focal })}</figure>`).join('')}</div>
  </div>
</section>`;
const view = main.querySelector('.pb__view');
const canvas = main.querySelector('canvas');
const stack = [...main.querySelectorAll('.pb__img')];
const texts = IDS.map((id) => {
  const t = textBlock(id);
  t.classList.add('pb__text');
  view.append(t);
  return t;
});
main.append(endBlock('zoom'));
versionBar('zoom');

// ---------- WebGL ----------
const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D tA, dA, tB, dB;
uniform vec2 vpA, vpB;          // punto de fuga (uv de la imagen, y hacia arriba)
uniform float aspImg, aspScr;   // aspecto de la imagen y de la pantalla
uniform float zA;               // zoom de la foto actual (1 … ~1.9)
uniform float zB;               // tamaño de la foto siguiente dentro de la puerta (0 … 1)
uniform float K;                // intensidad del parallax por profundidad
vec2 visible(){ return aspScr > aspImg ? vec2(1.0, aspImg / aspScr) : vec2(aspScr / aspImg, 1.0); }
// pantalla → imagen, como object-fit: cover, centrado en el punto de fuga (sin salirse de la imagen)
vec2 cover(vec2 s, vec2 vp, float z, out vec2 c){
  vec2 vis = visible() / z;
  c = clamp(vp, vis * 0.5, 1.0 - vis * 0.5);
  return c + (s - 0.5) * vis;
}
vec4 zoomed(sampler2D t, sampler2D d, vec2 s, vec2 vp, float z){
  vec2 c;
  vec2 uv = cover(s, vp, z, c);
  // el primer plano (d ≈ 1) se agranda más que el fondo: dos pasos para estabilizar el muestreo
  vec2 vis = visible() / z;
  for (int i = 0; i < 2; i++) {
    float depth = texture2D(d, uv).r;
    float ze = 1.0 + K * (z - 1.0) * depth;
    uv = c + (s - 0.5) * vis / ze;
  }
  return texture2D(t, clamp(uv, 0.0, 1.0));
}
void main(){
  vec4 col = zoomed(tA, dA, v, vpA, zA);
  if (zB > 0.0) {
    // la puerta se abre en el punto de pantalla donde está el punto de fuga de la foto actual
    vec2 c; cover(vec2(0.5), vpA, zA, c);
    vec2 door = 0.5 + (vpA - c) * zA / visible();
    door = mix(door, vec2(0.5), smoothstep(0.0, 1.0, zB));
    vec2 q = (v - door) / zB + 0.5;     // uv de pantalla dentro de la puerta
    vec2 edge = min(q, 1.0 - q);
    float inside = step(0.0, min(edge.x, edge.y));
    if (inside > 0.0) {
      vec2 c2;
      vec4 b = texture2D(tB, cover(q, vpB, 1.0, c2));
      // filo dorado de la puerta (se desvanece al llenar la pantalla)
      float px = 2.0 / (zB * 900.0);
      float line = (1.0 - smoothstep(px, px * 1.8, min(edge.x, edge.y))) * (1.0 - smoothstep(0.85, 1.0, zB));
      col = mix(b, vec4(0.79, 0.64, 0.29, 1.0), line);
    }
  }
  gl_FragColor = col;
}`;

let gl = null;
const useGL = !reduced && !saveData && !lowEnd && (() => {
  try {
    gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    return Boolean(gl);
  } catch {
    return false;
  }
})();
document.documentElement.classList.toggle('pb-gl', useGL);

const tag = () => (portrait() ? 'mobile' : 'desktop');
const textures = [];
let prog;
const U = {};
async function setupGL() {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['tA', 'dA', 'tB', 'dB', 'vpA', 'vpB', 'aspImg', 'aspScr', 'zA', 'zB', 'K']) U[n] = gl.getUniformLocation(prog, n);
  const load = (url) =>
    new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        res({ t, w: im.naturalWidth, h: im.naturalHeight });
      };
      im.onerror = rej;
      im.src = url;
    });
  const t = tag();
  await Promise.all(
    photos.map(async (p, j) => {
      const [img, dep] = await Promise.all([load(`${content.imagenes.base}${p.f.id}-${t}.webp`), load(`/assets/profundidad/${p.f.id}-${t}.webp`)]);
      const [fx, fy] = pct(p.f.fuga || p.f.focal);
      // en vertical la foto ya está recortada sobre el punto focal: el punto de fuga va al centro en X
      textures[j] = { img, dep, vp: t === 'mobile' ? [0.5, 1 - fy] : [fx, 1 - fy] };
    }),
  );
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  gl?.viewport(0, 0, canvas.width, canvas.height);
}
const bind = (unit, tex, name) => {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(U[name], unit);
};
function draw(pos) {
  const j = Math.min(P - 1, Math.floor(pos));
  const f = pos - j;
  const A = textures[j];
  const B = textures[Math.min(P - 1, j + 1)];
  if (!A) return;
  // acercamiento que se acelera; la puerta empieza a abrirse a mitad del tramo
  const zA = j < P - 1 ? 1 + 0.95 * f ** 2.2 : 1 + 0.08 * f;
  const t = j < P - 1 ? Math.min(1, Math.max(0, (f - 0.32) / 0.68)) : 0;
  const zB = t > 0 ? 0.06 + 0.94 * (1 - (1 - t) ** 2.4) : 0;
  bind(0, A.img.t, 'tA');
  bind(1, A.dep.t, 'dA');
  bind(2, B.img.t, 'tB');
  bind(3, B.dep.t, 'dB');
  gl.uniform2f(U.vpA, ...A.vp);
  gl.uniform2f(U.vpB, ...B.vp);
  gl.uniform1f(U.aspImg, A.img.w / A.img.h);
  gl.uniform1f(U.aspScr, canvas.width / canvas.height);
  gl.uniform1f(U.zA, zA);
  gl.uniform1f(U.zB, zB >= 0.999 ? 0.0 : zB);
  gl.uniform1f(U.K, 0.32);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

let ready = false;
if (useGL) {
  resize();
  window.addEventListener('resize', resize);
  setupGL()
    .then(() => (ready = true))
    .catch((err) => {
      console.error('[zoom] sin WebGL, se usan fundidos', err);
      document.documentElement.classList.remove('pb-gl');
    });
} else stack.forEach(loadPicture);

setupScroll(main.querySelector('.pb'), (p, { tracker }) => {
  const pos = p * (P - 1);
  const u = mapU(pos, U_POINTS);
  tracker.update(u, N_GLOBAL);
  syncPasos(view, u);
  if (ready) draw(pos);
  else stack.forEach((el, j) => (el.style.opacity = String(Math.max(0, 1 - Math.abs(pos - j) * 1.6)))); // sin WebGL / reduced motion: fundidos
  const stageIdx = Math.floor(u);
  texts.forEach((t) => t.classList.toggle('is-on', Number(t.dataset.etapa) === stageIdx));
});
