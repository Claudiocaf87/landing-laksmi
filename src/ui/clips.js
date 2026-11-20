// Modo video: cada etapa puede tener un clip que avanza con el scroll (es.json → videos.clips y
// {"clip": "<id>"} en las fotos de la etapa).
// - La foto (el primer cuadro del clip) se ve al instante como póster; el video la reemplaza con un
//   fundido cuando está descargado entero y posicionado en el cuadro que corresponde.
// - Se descarga de a un clip: el de la etapa actual y, cuando termina, el de la siguiente. Al saltar
//   por el menú se cancela lo demás y se pide solo el destino.
// - Sin video (queda la foto con su desplazamiento lateral): ahorro de datos, 2g/3g, gama baja,
//   movimiento reducido, si el video falla o si el visitante lleva más de 3 s mirando el póster
//   sin que el clip esté listo. En ese último caso no se piden más clips en la visita.
// - Se descarga entero (fetch → blob): buscar un cuadro no vuelve a la red y el avance es fluido.

export function createClips({ content, enabled }) {
  const V = content.videos;
  const wait = (V.esperaMaxima || 3) * 1000;
  const params = new URLSearchParams(location.search);
  const items = [...document.querySelectorAll('.foto--clip')].map((fig) => {
    const id = params.get(`clip-${fig.dataset.clip}`) || fig.dataset.clip; // ?clip-feria=feria-5s para comparar variantes
    return { fig, id, stage: Number(fig.dataset.etapa), video: fig.querySelector('video'), state: 'idle', bytes: 0, visibleSince: null };
  });
  const status = { activo: enabled, lento: false, clips: items };
  let slow = false;
  let loading = null;

  // AV1 si el navegador lo decodifica (más calidad por byte); si no, H.264. ?codec=h264 para comparar
  const probe = document.createElement('video');
  const av1 = params.get('codec') !== 'h264' && probe.canPlayType('video/mp4; codecs="av01.0.08M.08"') === 'probably';
  status.codec = av1 ? 'av1' : 'h264';
  const src = (it) => {
    const view = window.matchMedia('(orientation: portrait)').matches ? 'mobile' : 'desktop';
    return `${V.base}${it.id}-${view}.${av1 ? 'av1.mp4' : 'mp4'}`;
  };
  // foto nítida en reposo: mientras el clip está en su primer cuadro se ve la foto original
  const reposo = V.fotoEnReposo !== false && params.get('reposo') !== '0';
  items.forEach((it) => (it.nitida = reposo && it.fig.hasAttribute('data-nitida')));

  const fail = (it, why) => {
    it.state = 'failed';
    it.why = why;
    it.ctrl?.abort();
    if (loading === it) loading = null;
    it.fig.classList.remove('has-video');
    if (why === 'lento') {
      slow = true;
      status.lento = true;
    }
  };

  async function load(it) {
    loading = it;
    it.state = 'loading';
    it.ctrl = new AbortController();
    it.url = src(it);
    const t0 = performance.now();
    try {
      const res = await fetch(it.url, { signal: it.ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        it.bytes += value.length;
        // si ya lo están mirando y al ritmo actual no llega a tiempo, se corta antes (ahorra datos)
        const now = performance.now();
        if (it.visibleSince != null && total && now - t0 > 500) {
          const eta = now + ((total - it.bytes) / it.bytes) * (now - t0);
          if (eta > it.visibleSince + wait) return fail(it, 'lento');
        }
      }
      if (it.state !== 'loading') return;
      it.blob = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
      it.video.src = it.blob;
      it.video.load();
      await new Promise((ok, ko) => {
        it.video.addEventListener('loadeddata', ok, { once: true });
        it.video.addEventListener('error', () => ko(new Error('decodificación')), { once: true });
      });
      it.video.addEventListener('seeked', () => (it.primed = true), { once: true });
      it.loadMs = Math.round(performance.now() - t0);
      it.state = 'ready';
      it.seekTo = null;
    } catch (err) {
      if (it.state === 'loading') fail(it, err.name === 'AbortError' ? 'cancelado' : 'error');
      if (it.why === 'cancelado') it.state = 'idle'; // se puede volver a pedir
    } finally {
      if (loading === it) loading = null;
    }
  }

  // stages: etapas en orden de prioridad (la actual primero). Cancela lo que no esté en la lista.
  const want = (stages) => {
    if (!enabled || slow) return;
    if (loading && !stages.includes(loading.stage)) loading.ctrl.abort();
    if (loading) return;
    for (const s of stages) {
      const next = items.find((it) => it.stage === s && it.state === 'idle');
      if (next) return void load(next);
      if (items.some((it) => it.stage === s && it.state === 'loading')) return;
    }
  };

  // en cada cuadro: posiciona los clips visibles según el scroll y controla la espera máxima
  const update = (now) => {
    for (const it of items) {
      const visible = it.fig.style.visibility === 'visible' && it.window && it.u >= it.window[0] && it.u <= it.window[1];
      if (!visible) {
        it.visibleSince = null;
        continue;
      }
      if (it.state === 'ready') {
        const v = it.video;
        const d = v.duration || 0;
        const t = Math.min(d - 0.05, Math.max(0, it.p * d));
        // el fundido arranca cuando ya está dibujado el cuadro que pidió el scroll (la primera búsqueda
        // terminó); mientras se sigue scrolleando, el video acompaña con el retraso normal de una búsqueda.
        // Se revisa antes de pedir la búsqueda siguiente.
        if (!it.fig.classList.contains('has-video') && !v.seeking && (it.primed || Math.abs(v.currentTime - t) <= 0.5 / 24)) {
          it.fig.classList.add('has-video');
          it.shownAt = { u: it.u, desfase: Math.abs(v.currentTime - t) };
        }
        // no se encolan búsquedas: solo cuando terminó la anterior y el cambio supera medio cuadro
        if (!v.seeking && Math.abs(v.currentTime - t) > 0.5 / 24) v.currentTime = t;
        // foto nítida: en el primer cuadro (antes de que el clip empiece a avanzar) se ve la foto; en cuanto
        // avanza, el video. Si el video ya está lejos del primer cuadro no se vuelve a la foto.
        if (it.nitida) it.fig.classList.toggle('en-reposo', it.p <= 0 && v.currentTime < 1.5 / 24);
        continue;
      }
      if (!enabled || it.state === 'failed') continue;
      it.visibleSince ??= now;
      if (now - it.visibleSince > wait) fail(it, 'lento');
    }
  };

  // journey informa la posición: u global y la ventana de cada clip
  const setU = (u) => {
    for (const it of items) {
      it.u = u;
      if (it.slot) it.p = Math.min(1, Math.max(0, (u - it.slot[0]) / it.slot[1]));
    }
  };

  window.__clips = status;
  return { items, want, update, setU, status };
}
