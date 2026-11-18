import { FORM_ENDPOINT, MAX_FILE_MB, isFormConfigured } from '../config.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const wa = (num, msg) => `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;

// Formulario de cotización. Envía multipart/form-data al endpoint configurado (Formspree por defecto).
// Si el envío con imagen falla (p. ej. plan sin adjuntos), reintenta sin la imagen y ofrece WhatsApp.
export function initForm(content) {
  const k = content.cotizacion;
  const msgs = k.mensajes;
  const form = document.getElementById('form-cotizar');
  if (!form) return;
  const status = form.querySelector('.form__status');
  const button = form.querySelector('button[type="submit"]');
  const fileInput = form.querySelector('#f-imagen');
  const required = [...form.querySelectorAll('[required]')];

  const setError = (input, text) => {
    const err = document.getElementById(`${input.id}-err`);
    if (err) err.textContent = text || '';
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  const check = (input) => {
    const v = input.value.trim();
    if (input.required && !v) return setError(input, msgs.requerido), false;
    if (input.type === 'email' && v && !EMAIL.test(v)) return setError(input, msgs.email), false;
    setError(input, '');
    return true;
  };
  const checkFile = () => {
    const f = fileInput.files[0];
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) return setError(fileInput, msgs.archivo), false;
    setError(fileInput, '');
    return true;
  };

  const setStatus = (type, text, waMsg = null) => {
    status.dataset.type = type;
    status.textContent = text;
    if (waMsg) {
      const a = document.createElement('a');
      a.className = 'btn btn--wa btn--small';
      a.href = wa(content.contacto.whatsapp, waMsg);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = k.whatsapp.texto;
      status.append(' ', a);
    }
  };

  required.forEach((f) => f.addEventListener('blur', () => f.value && check(f)));
  required.forEach((f) => f.addEventListener('input', () => f.hasAttribute('aria-invalid') && check(f)));
  fileInput.addEventListener('change', checkFile);

  const send = (data) => fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = required.filter((f) => !check(f));
    if (!checkFile()) invalid.push(fileInput);
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    const nombre = form.nombre.value.trim();
    const producto = form.producto.value.trim().slice(0, 140);
    const waFollow = k.whatsapp.mensajeConDatos.replace('{nombre}', nombre).replace('{producto}', producto);
    if (!isFormConfigured()) {
      setStatus('error', msgs.noConfigurado, waFollow);
      return;
    }
    button.disabled = true;
    setStatus('info', msgs.enviando);
    const data = new FormData(form);
    const hasFile = fileInput.files.length > 0;
    try {
      let res = await send(data);
      let fileDropped = false;
      if (!res.ok && hasFile) {
        data.delete('imagen');
        res = await send(data);
        fileDropped = true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      if (fileDropped) setStatus('ok', msgs.exitoSinArchivo, waFollow);
      else setStatus('ok', msgs.exito);
    } catch {
      setStatus('error', msgs.error, waFollow);
    } finally {
      button.disabled = false;
    }
  });
}

// Selector "¿Cuál es tu caso?": marca el perfil, completa "Mayor problema" y lleva al formulario.
export function initProfiles(goTo) {
  const buttons = [...document.querySelectorAll('.profile')];
  const problema = document.getElementById('f-problema');
  const perfil = document.getElementById('f-perfil');
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      perfil.value = b.dataset.perfil;
      if ([...problema.options].some((o) => o.value === b.dataset.problema)) problema.value = b.dataset.problema;
      goTo('cotizar');
      setTimeout(() => document.getElementById('f-nombre').focus({ preventScroll: true }), 900);
    }),
  );
}
