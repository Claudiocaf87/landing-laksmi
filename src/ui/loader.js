// Pantalla de carga con porcentaje. set(p) recibe 0..1; el número sube suave hasta ese valor.
// Al terminar se desvanece y, cuando ya no se ve, se quita .is-loading (eso hace entrar el hero).
export function createLoader() {
  const el = document.querySelector('.loader');
  const num = el.querySelector('.loader__num span');
  const bar = el.querySelector('.loader__bar span');
  let shown = 0;
  let target = 0;
  let finished = null;

  const frame = () => {
    shown += (target - shown) * 0.12;
    if (target - shown < 0.002) shown = target;
    const pct = Math.round(shown * 100);
    num.textContent = pct;
    bar.style.transform = `scaleX(${shown})`;
    el.setAttribute('aria-valuenow', pct);
    if (shown >= 1 && finished) {
      // en secuencia: primero se va el loader por completo y recién después entra el hero
      el.classList.add('is-done');
      const reveal = () => {
        document.documentElement.classList.remove('is-loading');
        el.remove();
      };
      el.addEventListener('transitionend', reveal, { once: true });
      setTimeout(reveal, 900); // por si no hay transición (reduced motion, pestaña oculta)
      finished();
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    set(p) {
      target = Math.max(target, Math.min(1, p));
    },
    done() {
      target = 1;
      return new Promise((resolve) => (finished = resolve));
    },
  };
}
