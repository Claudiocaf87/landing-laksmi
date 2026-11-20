// Modo video: cada etapa puede tener un clip que avanza con el scroll (es.json → videos.clips y
// {"clip": "<id>"} en las fotos de la etapa).
// - La foto (el primer cuadro del clip) se ve al instante como póster; el video la reemplaza con un
//   fundido cuando está descargado entero y posicionado en el cuadro que corresponde.
// - Se descarga de a un clip: el de la etapa actual y, cuando termina, el de la siguiente. Al saltar
//   por el menú se cancela lo demás y se pide solo el destino.
// - Se descarga entero (fetch → blob): buscar un cuadro no vuelve a la red y el avance es fluido.
// - Si un clip tarda: el visitante sigue viendo la foto. Pasados 3 s mirándola, ese clip ya no la
//   reemplaza en esta pasada (nada de saltos tardíos); la descarga sigue y se usa al volver a la etapa.
//   Un clip lento no apaga los demás.
// - Sin video (queda la foto con su desplazamiento lateral): ahorro de datos, 2g, gama baja, movimiento
//   reducido, o si la conexión medida es muy lenta (dos descargas seguidas por debajo de ~1,2 Mbps).
// - Si un clip falla (red o decodificación) se reintenta una vez; si era AV1, se pasa a H.264.

const LENTO_KBPS = 1200;
// desktop: versión 1080p (~2,4 MB) o liviana 720p (~1 MB). Se elige con la velocidad medida de cada descarga
const BAJAR_KBPS = 9000; // por debajo, el clip de 1080p tarda más que la etapa: se pasa a la liviana
const SUBIR_KBPS = 16000;

export function createClips({ content, enabled }) {
  const V = content.videos;
  const wait = (V.esperaMaxima || 3) * 1000;
  const params = new URLSearchParams(location.search);
  const items = [...document.querySelectorAll('.foto--clip')].map((fig) => {
    const id = params.get(`clip-${fig.dataset.clip}`) || fig.dataset.clip; // ?clip-feria=feria-5s para comparar variantes
    return { fig, id, stage: Number(fig.dataset.etapa), video: fig.querySelector('video'), state: 'idle', bytes: 0, visibleSince: null, tries: 0, late: false };
  });
  const status = { activo: enabled, lento: false, clips: items, kbps: [] };
  let slow = false;
  let loading = null;

  // AV1 si el navegador lo decodifica (más calidad por byte); si no, H.264. ?codec=h264 para comparar
  const probe = document.createElement('video');
  const av1 = params.get('codec') !== 'h264' && probe.canPlayType('video/mp4; codecs="av01.0.08M.08"') === 'probably';
  status.codec = av1 ? 'av1' : 'h264';
  items.forEach((it) => (it.codec = status.codec));
  const downlink = navigator.connection?.downlink; // estimación inicial del navegador (Mbps), si la da
  let ligera = params.get('calidad') === 'ligera' || (params.get('calidad') !== 'alta' && downlink > 0 && downlink < 6);
  const portrait = () => window.matchMedia('(orientation: portrait)').matches;
  const src = (it) => {
    const view = portrait() ? 'mobile' : ligera ? 'ligero' : 'desktop';
    return `${V.base}${it.id}-${view}.${it.codec === 'av1' ? 'av1.mp4' : 'mp4'}`;
  };
  // foto nítida en reposo: mientras el clip está en su primer cuadro se ve la foto original
  const reposo = V.fotoEnReposo !== false && params.get('reposo') !== '0';
  items.forEach((it) => (it.nitida = reposo && it.fig.hasAttribute('data-nitida')));

  const fail = (it, why) => {
    it.state = 'failed';
    it.why = why;
    if (loading === it) loading = null;
    it.fig.classList.remove('has-video');
  };

  async function load(it) {
    loading = it;
    it.state = 'loading';
    it.tries++;
    it.ctrl = new AbortController();
    it.url = src(it);
    const t0 = performance.now();
    let got = 0;
    try {
      const res = await fetch(it.url, { signal: it.ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        it.bytes += value.length;
      }
      if (it.state !== 'loading') return;
      // velocidad medida: si dos descargas seguidas van muy lentas, no se piden más clips (ahorra datos)
      const kbps = Math.round((got * 8) / Math.max(1, performance.now() - t0));
      status.kbps.push(kbps);
      const last = status.kbps.slice(-2);
      if (last.length === 2 && last.every((k) => k < LENTO_KBPS)) slow = status.lento = true;
      if (!portrait() && params.get('calidad') == null) {
        if (kbps < BAJAR_KBPS) ligera = true;
        else if (kbps > SUBIR_KBPS) ligera = false;
      }
      status.calidad = portrait() ? 'mobile' : ligera ? 'ligera' : 'alta';
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
    } catch (err) {
      if (it.state !== 'loading') return;
      if (err.name === 'AbortError') {
        it.state = 'idle'; // cancelado por un salto: se vuelve a pedir cuando haga falta
        it.tries--;
      } else if (it.tries < 2) {
        // un reintento; si el problema fue decodificar AV1, el reintento va en H.264
        if (err.message === 'decodificación' && it.codec === 'av1') it.codec = 'h264';
        it.state = 'idle';
        it.why = err.message;
      } else fail(it, err.message);
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
        it.late = false; // al volver a la etapa, si ya está listo, se usa el video
        continue;
      }
      if (it.state === 'ready' && !it.late) {
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
      if (!enabled || it.state === 'failed' || it.late) continue;
      // todavía no está: se sigue viendo la foto. Pasados 3 s, en esta pasada se queda la foto
      it.visibleSince ??= now;
      if (now - it.visibleSince > wait) it.late = true;
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
