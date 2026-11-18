// Pantalla de carga con porcentaje. set(p) recibe 0..1; el número sube suave hasta ese valor.
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
      el.classList.add('is-done');
      document.documentElement.classList.remove('is-loading');
      setTimeout(() => el.remove(), 900);
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
