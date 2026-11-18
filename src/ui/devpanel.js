// Panel solo para desarrollo (no entra en el build): fps, draw calls, triángulos, u y set activo.
// window.__dev expone las mismas cifras; window.__stage y window.__journey sirven para medir.
export function mountDevPanel(getStage) {
  const el = document.createElement('aside');
  el.className = 'devpanel';
  el.innerHTML = '<strong>DEV</strong><pre data-stats>—</pre>';
  document.body.append(el);
  const out = el.querySelector('[data-stats]');
  let frames = 0;
  let last = performance.now();
  const stats = { fps: 0, calls: 0, tris: 0 };
  window.__dev = stats;
  const loop = (now) => {
    frames++;
    if (now - last >= 500) {
      stats.fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      const s = getStage();
      if (s?.renderer) {
        const info = s.renderer.info;
        stats.calls = info.render.calls;
        stats.tris = info.render.triangles;
        stats.geometries = info.memory.geometries;
        stats.textures = info.memory.textures;
        stats.u = Number(s.u.toFixed(3));
        stats.set = s.set;
      }
      out.textContent = `fps   ${stats.fps}\ncalls ${stats.calls}\ntris  ${stats.tris}\nu     ${stats.u ?? '—'}\nset   ${stats.set ?? '—'}`;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
