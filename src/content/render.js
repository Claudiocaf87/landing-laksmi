// Convierte src/content/<idioma>.json en HTML estático. Lo usa vite.config.js al servir y al
// compilar: todo el texto queda en el HTML (SEO y lectores de pantalla) aunque se edite solo en el JSON.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const lines = (t) => (Array.isArray(t) ? t : [t]).map((l) => `<span>${esc(l)}</span>`).join(' ');
export const waLink = (num, msg) => `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;

const ICONS = {
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 20.5v-7h2.4l.4-2.8h-2.8V8.9c0-.8.3-1.4 1.4-1.4h1.5V5a19 19 0 0 0-2.2-.1c-2.2 0-3.7 1.3-3.7 3.8v2H8.2v2.8h2.4v7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5l14 15M19 4.5l-14 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  whatsapp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5l1.1-3.9A8 8 0 1 1 8.6 18.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.2 8.6c.3-.6.6-.6.9-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .6-.3 1.3-.9 1.6-.6.3-1.5.4-3.1-.3a9 9 0 0 1-3.9-3.7c-.7-1.4-.6-2.5 0-3.2z" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function btn(c, cls = '') {
  if (!c) return '';
  const ext = c.externo ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a class="btn ${cls}" href="${esc(c.href)}"${ext}>${esc(c.texto)}</a>`;
}

function waBtn(c, cls = 'btn--ghost') {
  const w = c.cotizacion.whatsapp;
  return `<a class="btn ${cls}" href="${esc(waLink(c.contacto.whatsapp, w.mensaje))}" target="_blank" rel="noopener noreferrer" data-wa>${ICONS.whatsapp}${esc(w.texto)}</a>`;
}

function header(c) {
  const links = c.navegacion.map((n) => `<li><a href="${esc(n.href)}">${esc(n.texto)}</a></li>`).join('');
  return `
<header class="header">
  <a class="brand" href="#inicio" aria-label="${esc(c.marca.nombre)} — ${esc(c.ui.etapa)} 00">
    <img src="${esc(c.marca.logo)}" alt="${esc(c.marca.nombre)}" width="410" height="234">
  </a>
  <nav class="nav" aria-label="${esc(c.ui.menuPrincipal)}"><ul>${links}</ul></nav>
  <div class="header__actions">
    <a class="icon-btn" href="${esc(waLink(c.contacto.whatsapp, c.cotizacion.whatsapp.mensaje))}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${ICONS.whatsapp}</a>
    ${btn(c.marca.cta, 'btn--small header__cta')}
    <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="menu" aria-label="${esc(c.ui.abrirMenu)}">${ICONS.menu}<span>${esc(c.ui.menu)}</span></button>
  </div>
</header>`;
}

function menu(c) {
  const stages = c.etapas
    .map((e) => `<li><a href="#${esc(e.id)}"><span class="mono">${esc(e.numero)}</span>${esc(e.menu)}</a></li>`)
    .join('');
  const extra = [c.testimonios, c.faq, c.perfiles]
    .map((s) => `<li><a href="#${esc(s.id)}"><span class="mono">—</span>${esc(s.etiqueta)}</a></li>`)
    .join('');
  const social = c.redes
    .map((s) => `<li><a href="${esc(s.url)}" aria-label="${esc(s.etiqueta)}" target="_blank" rel="noopener noreferrer">${ICONS[s.red] ?? esc(s.etiqueta)}</a></li>`)
    .join('');
  return `
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="${esc(c.ui.menuPrincipal)}" hidden>
  <div class="menu__panel">
    <button class="icon-btn menu__close" type="button" aria-label="${esc(c.ui.cerrarMenu)}">${ICONS.close}</button>
    <nav aria-label="${esc(c.ui.menuPrincipal)}">
      <ul class="menu__list">${stages}${extra}
        <li><a href="#${esc(c.cotizacion.id)}"><span class="mono">${esc(c.cotizacion.numero)}</span>${esc(c.cotizacion.menu)}</a></li>
      </ul>
    </nav>
    <div class="menu__foot">
      ${waBtn(c, 'btn--solid')}
      <ul class="social" aria-label="${esc(c.ui.redes)}">${social}</ul>
    </div>
  </div>
</div>`;
}

function hud(c) {
  const h = c.hud;
  const items = h.estados
    .map(
      (s, i) =>
        `<li data-step="${i}"><a href="#${esc(s.ir)}"${s.u != null ? ` data-u="${s.u}"` : ''}><span class="hud__dot" aria-hidden="true"></span><span class="hud__txt">${esc(s.texto)}</span></a></li>`,
    )
    .join('');
  return `
<nav class="hud" aria-label="${esc(h.titulo)}">
  <div class="hud__head">
    <p class="hud__title">${esc(h.titulo)}</p>
    <p class="hud__code mono">${esc(h.codigo)}</p>
  </div>
  <ol class="hud__list">${items}</ol>
  <div class="hud__mobile" aria-hidden="true">
    <span class="hud__dot"></span>
    <span class="hud__now">${esc(h.estados[0].texto)}</span>
    <span class="hud__count mono">1/${h.estados.length}</span>
    <span class="hud__bar"><span></span></span>
  </div>
</nav>`;
}

function minimap(m) {
  // ruta estilizada: puertos de China → Pacífico → Panamá → destino (no es un trazado real)
  return `
<figure class="minimap">
  <svg viewBox="0 0 320 130" role="img" aria-label="${esc(m.origen)} → ${esc(m.destino)}">
    <path class="minimap__route" d="M36 46 C 100 22, 170 30, 226 80 S 268 96, 288 82" />
    <path class="minimap__done" d="M36 46 C 100 22, 170 30, 226 80 S 268 96, 288 82" pathLength="1" />
    <circle class="minimap__ship" r="5" cx="36" cy="46" />
    <circle class="minimap__pin" r="3.5" cx="36" cy="46" />
    <circle class="minimap__pin" r="3.5" cx="288" cy="82" />
  </svg>
  <figcaption>
    <span>${esc(m.origen)}</span>
    <span class="minimap__days"><strong class="mono">${esc(m.dias)}</strong> ${esc(m.etiquetaDias)}</span>
    <span>${esc(m.destino)}</span>
  </figcaption>
</figure>`;
}

function extras(e, c) {
  let out = '';
  if (e.puntos?.length) out += `<ul class="points">${e.puntos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  if (e.chips?.length) out += `<ul class="chips">${e.chips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  if (e.mapa) out += minimap(e.mapa);
  if (e.stats?.length) {
    out += `<dl class="stats">${e.stats
      .map(
        (s) =>
          `<div class="stat"><dt>${esc(s.etiqueta)}</dt><dd class="mono"><span>${esc(s.prefijo)}</span><span data-count="${esc(s.valor)}">${esc(Number(s.valor).toLocaleString('es-VE'))}</span></dd></div>`,
      )
      .join('')}</dl>`;
  }
  if (e.nota) out += `<p class="note">${esc(e.nota)}</p>`;
  if (e.cta || e.ctaWhatsapp) out += `<div class="actions">${btn(e.cta, 'btn--solid')}${e.ctaWhatsapp ? waBtn(c) : ''}</div>`;
  return out;
}

function etapa(e, i, c) {
  const h = i === 0 ? 'h1' : 'h2';
  return `
<section class="etapa" id="${esc(e.id)}" data-etapa="${i}" aria-labelledby="${esc(e.id)}-t">
  <div class="etapa__content">
    <div class="etapa__inner">
      <p class="kicker"><span class="mono">${esc(e.numero)}</span>${esc(e.etiqueta)}</p>
      <${h} class="etapa__title" id="${esc(e.id)}-t">${lines(e.titulo)}</${h}>
      <p class="etapa__sub">${esc(e.subtitulo)}</p>
      ${extras(e, c)}
    </div>
  </div>
</section>`;
}

function testimonios(t) {
  return `
<section class="block block--cream" id="${esc(t.id)}" aria-labelledby="${esc(t.id)}-t">
  <div class="block__wrap">
    <p class="kicker kicker--dark">${esc(t.etiqueta)}</p>
    <h2 class="block__title" id="${esc(t.id)}-t">${esc(t.titulo)}</h2>
    <p class="note note--dark">${esc(t.nota)}</p>
    <ul class="quotes">${t.items
      .map(
        (q) => `<li><figure><blockquote><p>${esc(q.cita)}</p></blockquote><figcaption><strong>${esc(q.nombre)}</strong><span>${esc(q.cargo)}</span></figcaption></figure></li>`,
      )
      .join('')}</ul>
  </div>
</section>`;
}

function faq(f) {
  return `
<section class="block block--cream" id="${esc(f.id)}" aria-labelledby="${esc(f.id)}-t">
  <div class="block__wrap block__wrap--split">
    <div>
      <p class="kicker kicker--dark">${esc(f.etiqueta)}</p>
      <h2 class="block__title" id="${esc(f.id)}-t">${esc(f.titulo)}</h2>
    </div>
    <div class="faq">${f.items.map((q) => `<details><summary>${esc(q.p)}</summary><p>${esc(q.r)}</p></details>`).join('')}</div>
  </div>
</section>`;
}

function perfiles(p) {
  return `
<section class="block block--ink" id="${esc(p.id)}" aria-labelledby="${esc(p.id)}-t">
  <div class="block__wrap">
    <p class="kicker">${esc(p.etiqueta)}</p>
    <h2 class="block__title" id="${esc(p.id)}-t">${esc(p.titulo)}</h2>
    <p class="block__sub">${esc(p.subtitulo)}</p>
    <ul class="profiles">${p.items
      .map(
        (x) =>
          `<li><button class="profile" type="button" aria-pressed="false" data-perfil="${esc(x.id)}" data-problema="${esc(x.problema)}"><strong>${esc(x.titulo)}</strong><span>${esc(x.texto)}</span></button></li>`,
      )
      .join('')}</ul>
  </div>
</section>`;
}

function select(id, label, opts, placeholder, required = false) {
  return `<select id="f-${id}" name="${id}"${required ? ' required' : ''} aria-describedby="f-${id}-err"><option value="">${esc(placeholder)}</option>${opts
    .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
    .join('')}</select>`;
}

function cotizacion(c) {
  const k = c.cotizacion;
  const f = k.campos;
  const o = k.opciones;
  const field = (id, label, control, { help = '', wide = false, req = false } = {}) => `
    <div class="field${wide ? ' field--wide' : ''}">
      <label for="f-${id}">${esc(label)}${req ? ' <span aria-hidden="true">*</span>' : ''}</label>
      ${help ? `<p class="field__help" id="f-${id}-help">${esc(help)}</p>` : ''}
      ${control}
      <p class="field__error" id="f-${id}-err"></p>
    </div>`;
  const input = (id, type, auto, req = true) =>
    `<input id="f-${id}" name="${id}" type="${type}" autocomplete="${auto}"${req ? ' required' : ''} aria-describedby="f-${id}-err">`;
  return `
<section class="block block--cream cotizar" id="${esc(k.id)}" aria-labelledby="${esc(k.id)}-t">
  <div class="block__wrap block__wrap--split">
    <div class="cotizar__intro">
      <p class="kicker kicker--dark"><span class="mono">${esc(k.numero)}</span>${esc(k.etiqueta)}</p>
      <h2 class="block__title block__title--xl" id="${esc(k.id)}-t">${lines(k.titulo)}</h2>
      <p class="block__sub">${esc(k.subtitulo)}</p>
      <div class="wa-card">
        <p>${esc(k.whatsapp.titulo)}</p>
        ${waBtn(c, 'btn--wa')}
        <p class="mono">${esc(c.contacto.telefono)} · <a href="mailto:${esc(c.contacto.email)}">${esc(c.contacto.email)}</a></p>
      </div>
    </div>
    <form class="form" id="form-cotizar" novalidate>
      ${field('nombre', f.nombre, input('nombre', 'text', 'name'), { req: true })}
      ${field('email', f.email, input('email', 'email', 'email'), { req: true })}
      ${field('telefono', f.telefono, input('telefono', 'tel', 'tel'), { req: true })}
      ${field('pais', f.pais, select('pais', f.pais, o.pais, f.elegir, true), { req: true })}
      ${field(
        'producto',
        f.producto,
        `<textarea id="f-producto" name="producto" rows="4" required aria-describedby="f-producto-help f-producto-err"></textarea>`,
        { help: f.productoAyuda, wide: true, req: true },
      )}
      ${field(
        'imagen',
        f.imagen,
        `<input id="f-imagen" name="imagen" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-describedby="f-imagen-help f-imagen-err">`,
        { help: f.imagenAyuda, wide: true },
      )}
      ${field('volumen', f.volumen, select('volumen', f.volumen, o.volumen, f.elegir))}
      ${field('comercializa', f.comercializa, select('comercializa', f.comercializa, o.comercializa, f.elegir))}
      ${field('tamano', f.tamano, select('tamano', f.tamano, o.tamano, f.elegir))}
      ${field('servicio', f.servicio, select('servicio', f.servicio, o.servicio, f.elegir))}
      ${field('problema', f.problema, select('problema', f.problema, o.problema, f.elegir), { wide: true })}
      <input type="hidden" name="perfil" id="f-perfil" value="">
      <input type="hidden" name="_subject" value="Nueva solicitud de cotización — landing 3D">
      <div class="hp" aria-hidden="true"><label>No completar <input name="_gotcha" tabindex="-1" autocomplete="off"></label></div>
      <div class="form__foot field--wide">
        <button class="btn btn--solid" type="submit">${esc(k.boton)}</button>
        <p class="form__legal">${esc(k.privacidad)}</p>
      </div>
      <div class="form__status field--wide" role="status" aria-live="polite"></div>
    </form>
  </div>
</section>`;
}

function footer(c) {
  const offices = c.contacto.oficinas.map((o) => `<li><strong>${esc(o.lugar)}</strong><span>${esc(o.direccion)}</span></li>`).join('');
  const social = c.redes
    .map((s) => `<li><a href="${esc(s.url)}" aria-label="${esc(s.etiqueta)}" target="_blank" rel="noopener noreferrer">${ICONS[s.red] ?? esc(s.etiqueta)}</a></li>`)
    .join('');
  return `
<footer class="footer">
  <div class="footer__wrap">
    <img src="${esc(c.marca.logo)}" alt="${esc(c.marca.nombre)}" width="410" height="234" loading="lazy">
    <ul class="footer__offices">${offices}</ul>
    <div class="footer__contact">
      <a class="mono" href="tel:+${esc(c.contacto.whatsapp)}">${esc(c.contacto.telefono)}</a>
      <a class="mono" href="mailto:${esc(c.contacto.email)}">${esc(c.contacto.email)}</a>
      <ul class="social" aria-label="${esc(c.ui.redes)}">${social}</ul>
    </div>
  </div>
  <p class="footer__legal">${esc(c.pie.texto)}</p>
</footer>`;
}

export function renderPage(html, c, lang) {
  return html
    .replaceAll('%LANG%', esc(lang))
    .replace('%TITLE%', esc(c.meta.titulo))
    .replace('%DESCRIPTION%', esc(c.meta.descripcion))
    .replace('%SKIP%', esc(c.ui.saltar))
    .replaceAll('%LOADING%', esc(c.ui.cargando))
    .replace('%SCROLL%', esc(c.ui.scroll))
    .replace('%LOGO%', esc(c.marca.logo))
    .replace('%BRAND%', esc(c.marca.nombre))
    .replace('<!--HEADER-->', header(c) + menu(c))
    .replace('<!--HUD-->', hud(c))
    .replace('<!--ETAPAS-->', c.etapas.map((e, i) => etapa(e, i, c)).join(''))
    .replace('<!--BLOQUES-->', testimonios(c.testimonios) + faq(c.faq) + perfiles(c.perfiles) + cotizacion(c))
    .replace('<!--FOOTER-->', footer(c));
}
