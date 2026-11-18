import { Color, Group, LoadingManager, NeutralToneMapping, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CameraRig } from './cameraRig.js';
import { CLOSE_START, buildGlobe } from './globe.js';
import { PALETTE } from './common.js';

// Lo único en 3D es el globo: aparece en el hero (u 0 … 1) y en el cierre (u ≥ CLOSE_START).
// El progreso (u) llega de la timeline maestra y acá se amortigua. Entre medio no se dibuja nada.
// snap (prefers-reduced-motion): el globo queda quieto en el encuadre sobre América, sin giro.
export const globeVisible = (u) => u < 1.08 || u >= CLOSE_START - 0.06;

export class Stage {
  constructor(canvas, { lite = false, snap = false, onProgress = () => {} } = {}) {
    this.canvas = canvas;
    this.lite = lite;
    this.snap = snap;
    this.onProgress = onProgress;
    this.u = 0;
    this.targetU = 0;
    this.time = 0;
    this.manager = new LoadingManager();
  }

  async build() {
    const r = new WebGLRenderer({ canvas: this.canvas, antialias: !this.lite, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.lite ? 1 : 1.5));
    r.toneMapping = NeutralToneMapping;
    r.outputColorSpace = SRGBColorSpace;
    this.renderer = r;

    this.scene = new Scene();
    this.scene.background = new Color(PALETTE.cream);
    // entorno generado por código (sin HDR): reflejos para los pines dorados
    const pmrem = new PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.camera = new PerspectiveCamera(45, 1, 0.1, 400);
    this.rig = new CameraRig();
    const group = new Group();
    this.scene.add(group);
    // en pantallas verticales / chicas el giro del hero es más corto (no se siente lento)
    const fast = window.innerWidth < 900 || window.innerHeight > window.innerWidth;
    this.globe = await buildGlobe({ group, manager: this.manager, lite: this.lite, fast });
    this.onProgress(0.8);
    this.resize();
    this.rig.apply(this.camera, 0);
    this.globe.update(0, 0);
    await r.compileAsync(this.scene, this.camera);
    this.onProgress(1);
    window.addEventListener('resize', this.resize);
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 58 : 45;
    this.renderer.setSize(w, h, false);
    this.frame();
  };

  // Encuadre: en desktop el globo va en el hueco a la derecha de la columna de texto;
  // en vertical, arriba. Se corre la ventana de proyección (no la cámara) y se escala el globo.
  frame() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = this.camera;
    let ox = 0;
    let oy = 0;
    let fit = 1;
    const fitFor = (rpx) => {
      const tanA = (rpx * Math.tan((cam.fov * Math.PI) / 360)) / (h / 2);
      return Math.min(1.1, Math.max(0.3, (41 * Math.sin(Math.atan(tanA))) / 10));
    };
    if (w / h < 1) {
      // vertical: el globo arriba y visible (≈ 40–45 % del alto), el texto debajo
      const header = document.querySelector('.header')?.offsetHeight || 64;
      const rpx = Math.min(w * 0.44, h * 0.19);
      const cy = header + 6 + rpx;
      oy = h / 2 - cy;
      fit = fitFor(rpx);
    } else {
      oy = 0;
      const inner = document.querySelector('.etapa__inner');
      const textRight = Math.max(inner ? inner.getBoundingClientRect().right : 0, w * 0.3);
      const left = textRight + 28;
      const right = w - Math.max(28, w * 0.04);
      const rpx = Math.min((right - left) / 2, h * 0.36);
      ox = -((left + right) / 2 - w / 2);
      fit = fitFor(rpx);
    }
    this.globe.setFit(fit);
    cam.setViewOffset(w, h, ox, oy, w, h);
    cam.updateProjectionMatrix();
  }

  setTarget(u) {
    this.targetU = u;
  }

  jump(u) {
    this.u = this.targetU = u;
  }

  // dt en segundos. Devuelve false si el globo no está en pantalla (no dibuja).
  tick(dt) {
    this.time += dt;
    if (this.snap) this.u = this.targetU < 1 ? 0.8 : this.targetU >= CLOSE_START ? CLOSE_START + 0.25 : this.targetU; // quieto, en el encuadre final
    else {
      const k = 1 - Math.exp(-dt * 5.5);
      this.u += (this.targetU - this.u) * k;
      if (Math.abs(this.targetU - this.u) < 1e-4) this.u = this.targetU;
    }
    if (!globeVisible(this.u)) return false;
    const u = Math.min(this.u, 10 - 1e-4);
    this.rig.apply(this.camera, u);
    this.globe.update(u, this.snap ? 0 : this.time);
    this.renderer.render(this.scene, this.camera);
    return true;
  }
}
