// Menú a pantalla completa (mobile y desktop): lista todas las etapas + bloques.
// Cierra con Escape, con el botón o al elegir un destino; atrapa el foco mientras está abierto.
export function initMenu({ onOpen = () => {}, onClose = () => {}, labels }) {
  const menu = document.getElementById('menu');
  const openBtn = document.querySelector('.menu-btn');
  const closeBtn = menu.querySelector('.menu__close');
  const hudBar = document.querySelector('.hud__mobile');
  let lastFocus = null;

  const focusables = () => [...menu.querySelectorAll('a, button')].filter((el) => el.offsetParent !== null);

  const open = () => {
    lastFocus = document.activeElement;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    openBtn.setAttribute('aria-expanded', 'true');
    openBtn.setAttribute('aria-label', labels.cerrarMenu);
    document.documentElement.classList.add('is-menu');
    onOpen();
    (menu.querySelector('[aria-current]') || focusables()[1])?.focus();
  };
  const close = (restore = true) => {
    if (menu.hidden) return;
    menu.classList.remove('is-open');
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.setAttribute('aria-label', labels.abrirMenu);
    document.documentElement.classList.remove('is-menu');
    setTimeout(() => (menu.hidden = true), 250);
    onClose();
    if (restore) lastFocus?.focus?.();
  };

  openBtn.addEventListener('click', () => (menu.hidden ? open() : close()));
  hudBar?.addEventListener('click', open);
  closeBtn.addEventListener('click', () => close());
  menu.addEventListener('click', (e) => {
    if (e.target === menu) close();
  });
  document.addEventListener('nav:go', () => close(false));
  document.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = focusables();
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  return { open, close };
}
