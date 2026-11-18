import { ACESFilmicToneMapping, LoadingManager, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { buildWorld } from './world.js';
import { CameraRig } from './cameraRig.js';

// Renderer + escena + cámara. El progreso del recorrido (u) llega de la timeline maestra y acá
// se amortigua, para que la cámara se mueva suave aunque el scroll sea brusco.
// snap (prefers-reduced-motion): sin vuelos de cámara; salta de estación en estación con un fundido.
export class Stage {
  constructor(canvas, { lite = false, snap = false, veil = null, onProgress = () => {} } = {}) {
    this.canvas = canvas;
    this.lite = lite;
    this.snap = snap;
    this.veil = veil;
    this.onProgress = onProgress;
    this.u = 0;
    this.targetU = 0;
    this.time = 0;
    this.flash = 0;
    this.set = 'globe';
    // todo loader (modelos, texturas, datos) usa este manager → el % del loader es real
    this.manager = new LoadingManager();
  }

  async build() {
    const r = new WebGLRenderer({ canvas: this.canvas, antialias: !this.lite, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.lite ? 1 : 1.5));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.toneMapping = ACESFilmicToneMapping;
    r.outputColorSpace = SRGBColorSpace;
    this.renderer = r;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.1, 900);
    this.rig = new CameraRig();
    this.resize();

    this.world = await buildWorld(this.scene, { lite: this.lite, manager: this.manager, onStep: (p) => this.onProgress(p * 0.9) });
    // compila los shaders de todos los sets ahora, para que no haya tirones al cambiar de set
    this.world.showAll(true);
    this.rig.apply(this.camera, 0);
    await r.compileAsync(this.scene, this.camera);
    this.world.showAll(false);
    this.frame();
    this.onProgress(1);
    window.addEventListener('resize', this.resize);
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 58 : 45;
    this.renderer?.setSize(w, h, false);
    this.frame();
  };

  // Encuadre: en desktop el sujeto queda a la derecha (el texto va a la izquierda);
  // en vertical queda arriba (el texto va abajo). Se corre la ventana de proyección, no la cámara.
  // El globo se ubica y escala en el hueco libre entre la columna de texto y el HUD.
  frame() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = this.camera;
    let ox = w / h >= 1 ? -w * 0.1 : 0;
    const oy = w / h >= 1 ? 0 : h * 0.16;
    let tight = false;
    const globe = this.world?.sets.globe.api;
    if (globe) {
      let fit = 1;
      if (w / h >= 1) {
        const inners = document.querySelectorAll('.etapa__inner');
        const textRight = Math.max(...[inners[0], inners[inners.length - 1]].filter(Boolean).map((el) => el.getBoundingClientRect().right), w * 0.3);
        const hud = document.querySelector('.hud');
        const hudLeft = hud && hud.offsetWidth ? hud.getBoundingClientRect().left : w;
        const left = textRight + 28;
        let right = hudLeft - 28;
        if (right - left < 340) {
          right = w - 28; // no entra entre texto y HUD: el HUD se oculta mientras se ve el globo
          tight = true;
        }
        const rpx = Math.min((right - left) / 2, h * 0.37);
        ox = -((left + right) / 2 - w / 2);
        // radio en pantalla → escala del globo para la distancia de la cámara en la estación (≈ 41)
        const tanA = (rpx * Math.tan((cam.fov * Math.PI) / 360)) / (h / 2);
        fit = Math.min(1.1, Math.max(0.45, (41 * Math.sin(Math.atan(tanA))) / 10));
      }
      globe.setFit(fit);
      this.globeOffset = ox;
    }
    this.baseOffset = w / h >= 1 ? -w * 0.1 : 0;
    this.tightGlobe = tight;
    const x = this.set === 'globe' && this.globeOffset != null ? this.globeOffset : this.baseOffset;
    cam.setViewOffset(w, h, x, oy, w, h);
    cam.updateProjectionMatrix();
    document.documentElement.classList.toggle('is-globe-tight', tight && this.set === 'globe');
  }

  setTarget(u) {
    this.targetU = u;
  }

  jump(u) {
    this.u = this.targetU = u;
  }

  // dt en segundos. Devuelve false si no hizo falta dibujar.
  tick(dt, maxU) {
    this.time += dt;
    if (this.snap) {
      const station = Math.min(maxU - 0.5, Math.floor(this.targetU) + 0.5);
      if (Math.abs(station - this.u) > 1e-3) {
        this.u = station;
        this.flash = 1;
      }
      this.flash = Math.max(0, this.flash - dt * 2.5);
    } else {
      const k = 1 - Math.exp(-dt * 5.5);
      this.u += (this.targetU - this.u) * k;
      if (Math.abs(this.targetU - this.u) < 1e-4) this.u = this.targetU;
    }
    // con los bloques HTML tapando la pantalla no hace falta dibujar
    if (this.u >= maxU - 0.002 && this.targetU >= maxU - 0.002) return false;

    const u = Math.min(this.u, maxU - 1e-4);
    const set = this.rig.setAt(u);
    if (set !== this.set) {
      this.set = set;
      this.frame();
    }
    if (this.veil) {
      const d = this.rig.cutDistance(u);
      const cut = 1 - Math.min(1, Math.max(0, (d - 0.004) / 0.04));
      this.veil.style.opacity = Math.max(cut, this.flash).toFixed(3);
    }
    this.rig.apply(this.camera, u);
    this.world.update(u, this.time, this.set);
    this.renderer.render(this.scene, this.camera);
    return true;
  }

  // renderiza una estación puntual y devuelve las estadísticas (para medir)
  measureAt(u) {
    const set = this.rig.setAt(u);
    if (set !== this.set) {
      this.set = set;
      this.frame();
    }
    this.rig.apply(this.camera, u);
    this.world.update(u, this.time, this.set);
    this.renderer.render(this.scene, this.camera);
    const { calls, triangles } = this.renderer.info.render;
    return { u, set: this.set, calls, triangles };
  }
}
