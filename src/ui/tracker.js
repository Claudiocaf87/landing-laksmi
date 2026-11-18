// Mapita fijo + HUD compacto. Lo usan el recorrido principal y los prototipos.
// update(u, N) recibe el u "global" del recorrido (0 … N): el estado del HUD sale de estados[].desde.
const STOP_F = [0, 0.05, 0.1, 0.15, 0.2, 0.55, 0.84, 1]; // fracción del mapita en la que cae cada etapa 01 … 08

export function createTracker(content) {
  const estados = content.hud.estados;
  const tracker = document.querySelector('.tracker');
  const route = tracker.querySelector('.tracker__route');
  const done = tracker.querySelector('.tracker__done');
  const ship = tracker.querySelector('.tracker__ship');
  const stops = [...tracker.querySelectorAll('.tracker__stop')];
  const len = route.getTotalLength();
  const pointAt = (f) => route.getPointAtLength(Math.min(1, Math.max(0, f)) * len);
  stops.forEach((c) => {
    const p = pointAt(Number(c.dataset.f));
    c.setAttribute('cx', p.x.toFixed(1));
    c.setAttribute('cy', p.y.toFixed(1));
  });
  const routeFraction = (u) => {
    if (u <= 1) return 0;
    if (u >= 8.5) return 1;
    const j = Math.floor(u); // etapa 1 … 8
    const a = STOP_F[j - 1];
    const b = j < 8 ? STOP_F[j] : 1;
    return a + (b - a) * Math.min(1, (u - j) / (j < 8 ? 1 : 0.5));
  };

  // lista desplegable de estados (botón con aria-expanded, Escape cierra)
  const toggle = tracker.querySelector('.tracker__toggle');
  const panel = tracker.querySelector('.tracker__panel');
  const hudItems = [...panel.querySelectorAll('li')];
  const hudNow = tracker.querySelector('.tracker__now');
  const hudCount = tracker.querySelector('.tracker__count');
  const hudBar = tracker.querySelector('.tracker__bar span');
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? content.ui.cerrarSeguimiento : content.ui.seguimiento);
    if (open) (panel.querySelector('[aria-current]') || panel.querySelector('a'))?.focus();
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !tracker.contains(e.target)) setOpen(false);
  });
  document.addEventListener('nav:go', () => !panel.hidden && setOpen(false));

  let step = -1;
  let lit = -1;
  return {
    el: tracker,
    update(u, N) {
      let s = 0;
      for (let k = 0; k < estados.length; k++) if (u >= estados[k].desde) s = k;
      if (s !== step) {
        step = s;
        hudItems.forEach((li, k) => {
          li.classList.toggle('is-done', k < s);
          li.classList.toggle('is-now', k === s);
          const a = li.querySelector('a');
          if (k === s) a.setAttribute('aria-current', 'step');
          else a.removeAttribute('aria-current');
        });
        hudNow.textContent = estados[s].texto;
        hudCount.textContent = `${s + 1}/${estados.length}`;
      }
      hudBar.style.transform = `scaleX(${Math.min(1, u / (N - 1)).toFixed(4)})`;
      // el trazo dorado avanza y se encienden los puntos de etapa
      const f = routeFraction(u);
      done.style.strokeDashoffset = String(1 - f);
      const p = pointAt(f);
      ship.setAttribute('cx', p.x.toFixed(1));
      ship.setAttribute('cy', p.y.toFixed(1));
      const idx = Math.floor(u);
      if (idx !== lit) {
        lit = idx;
        stops.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.etapa) <= idx));
      }
    },
  };
}
