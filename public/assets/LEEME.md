# Assets reemplazables

La landing es una historia fotográfica guiada por scroll; lo único en 3D es el globo.
Los textos alternativos, el orden de las fotos y el **punto focal** de cada una están en
`src/content/es.json` (`etapas[].fotos[]`, `rubros.items[]`).

**Para reemplazar una foto:** poné el original en `assets-fuente/<id>.jpg` (mismo nombre, mínimo
2000×1116, 16:9) y corré `npm run imagenes`. El script genera las versiones desktop y mobile, en AVIF y
WebP, sin metadatos y dentro del peso máximo. El recorte vertical para mobile se centra en el punto
focal de `es.json` (por ejemplo `"60% 40%"` = 60 % desde la izquierda, 40 % desde arriba).
Si cambia el globo: `npm run build && npm run globo-imagen && npm run imagenes`.

**Reglas**
- Desktop: 1920 px de ancho, ≤ 250 KB. Mobile: 900×1600 (vertical 9:16), ≤ 120 KB. Formato AVIF + WebP.
- Se carga solo la foto de la etapa actual y la siguiente (nada en el hero salvo el globo).
- Todas las fotos de esta muestra son **generadas con IA**: no muestran al equipo, a clientes ni a
  lugares reales de Laksmi, y no llevan leyendas que lo afirmen.
- **Dirección de arte:** si una foto tiene `"vertical": true` en `es.json`, la versión mobile sale de su
  propio original vertical (`assets-fuente/<id>-vertical.jpg`, ≥ 900×1600) y se sirve en pantallas
  verticales (`<picture>` con `media="(orientation: portrait)"`); no se recorta la horizontal.
- Sin original vertical, el corte de mobile sale de la horizontal: con originales de 1116 px de alto
  se agranda 1,43× hasta 900 px y puede verse algo blando (hoy se nota en `precinto`).

## Fotos (en `fotos/`)

| Archivo (`<id>-desktop|mobile.avif|webp`) | Etapa | Punto focal | Desktop | Mobile |
|---|---|---|---|---|
| `plan` | 01 Plan | 40% 35% | 1920×1071 | 900×1600 |
| `feria-01` | 02 Ferias (1/3) | 40% 40% | 1920×1071 | 900×1600 |
| `feria-02` | 02 Ferias (2/3) | 60% 40% | 1920×1071 | 900×1600 |
| `feria-detalle` | 02 Ferias (3/3), frase "Anotamos cada muestra." | 62% 50% | 1920×1071 | 900×1600 |
| `negociacion` | 03 Negociación (los dos estados) | 52% 40% | 1920×1071 | 900×1600 |
| `calidad` | 04 Calidad | 55% 42% | 1920×1071 | 900×1600 |
| `carga` | 05 Despacho (1/3) | 70% 50% | 1920×1071 | 900×1600 |
| `precinto` | 05 Despacho (2/3) · v2 · **provisional**: sigue mostrando un candado; reemplazar por un precinto de seguridad con el mismo nombre (ideal: también `precinto-vertical.jpg`) | 60% 58% | 1920×1071 | 900×1600 (agrandada 1,43×) |
| `puerto` | 05 Despacho (3/3) | 55% 45% | 1920×1071 | 900×1600 |
| `transito` | 06 Tránsito (+ mapa grande) | 48% 55% | 1920×1071 | 900×1600 |
| `aduana` | 07 Aduana | 39% 45% | 1920×1071 | 900×1600 |
| `entrega` | 08 Entrega | 62% 55% | 1920×1071 | 900×1600 |
| `tienda` | 09 Resultados · "Opción B en su tienda" (horizontal) + "vertical" para mobile, con dirección de arte | 38% 40% (vertical: 60% 45%) | 1920×1071 | 900×1600 (de su original vertical, sin agrandar) |
| `globo-hero` · `globo-cierre` | 00 y 09, solo sin WebGL / ahorro de datos / gama baja (capturas del globo 3D) | — | 900×900 | 600×600 |
| `rubro-automotriz` | Bloque Rubros (cuadrada) | 47% 50% | 800×800 | 480×480 |

`og/og-laksmi.jpg` (1200×630): vista previa al compartir, recortada de `transito`.
`data/globo-puntos.bin`: tierra del globo (Natural Earth, dominio público; `npm run globo`).
`logo/`: `logo-color` (fondos claros), `logo-blanco` (footer azul), `favicon.png`.

## Alternativas guardadas (no se publican)

| Archivo | Qué es |
|---|---|
| `assets-fuente/opcion-a-deposito.jpg` · `opcion-a-deposito-vertical.jpg` | "Opción A en su depósito", alternativa a la foto final. **Pendiente: no llegó el archivo.** |

## Lo que falta

| Archivo | Qué tiene que mostrar | Medida y formato |
|---|---|---|
| `assets-fuente/precinto.jpg` (+ `precinto-vertical.jpg`) | Precinto de seguridad (sello numerado tipo perno o cable, no un candado) en las puertas de un contenedor | ≥ 2000×1116 · vertical ≥ 1116×2000 |
| `assets-fuente/rubro-ferreteria.jpg` · `-medico` · `-bisuteria` · `-tecnologia` | Un producto por rubro, fondo claro, sin marcas | ≥ 1200×1200 |
| Fotos reales del equipo en la Feria de Cantón | Para las etapas de ferias y negociación, con leyenda [FERIA, AÑO, QUIÉN ES] | ≥ 2000 px de ancho |
| `assets-fuente/videos/<archivo>_vertical.mp4` | Versiones verticales de feria, puerto y tránsito (reemplazan el recorte de la horizontal) | 720×1280 o más, 24 fps |
| `logo/logo.svg` | Logo vectorial (color y blanco) | SVG |

## Prototipos de avance (rama `prototipo-avance`, no publicados)

| Archivo | Uso | Cómo se genera | Peso |
|---|---|---|---|
| `video/puerto-{desktop,mobile}.{mp4,webm}` | Versión C: usa el clip del puerto del modo video (v2) | `npm run videos` | ver abajo |
| `profundidad/<id>-{desktop,mobile}.webp` | Versión B (mapa de profundidad por foto, blanco = cerca) | `npm run profundidad` (Depth Anything V2 Small en ONNX, en CPU; modelo en `.cache/`) | 1,5–2,7 KB c/u |

Videos sin audio, con un keyframe cada ½ s para que el avance con el scroll sea fluido en ambos sentidos.
El punto de fuga de cada foto de la versión B está en `es.json` (`fotos[].fuga`).

## Modo video (rama `fase3-video`)

Clips generados con IA, sin audio: no muestran al equipo, a clientes ni a lugares reales de Laksmi.

| Archivo | Etapa | Origen | Peso (MP4 / WebM) |
|---|---|---|---|
| `video/feria-{desktop,mobile}.{mp4,webm}` | 02 Ferias (10 s completos) | `assets-fuente/videos/feria_video_horizontal.mp4` | 1,30 / 1,29 MB · 0,75 / 0,74 MB |
| `video/feria-5s-{desktop,mobile}.{mp4,webm}` | 02 Ferias (variante: 0,5 a 5,5 s) | ídem | 1,19 / 1,12 MB · 0,70 / 0,65 MB |
| `video/puerto-{desktop,mobile}.{mp4,webm}` | 05 Despacho (Embarcado) | `assets-fuente/videos/v2_puerto_video.mp4` | 1,29 / 1,31 MB · 0,74 / 0,73 MB |
| `video/transito-{desktop,mobile}.{mp4,webm}` | 06 Tránsito | `assets-fuente/videos/transito_video.mp4` | 1,30 / 1,29 MB · 0,75 / 0,76 MB |
| `fotos/video-<id>-{desktop,mobile}.{avif,webp}` | Póster de cada clip (su primer cuadro) | lo genera `npm run videos` | |

Para sumar un clip: dejarlo en `assets-fuente/videos/`, agregarlo a `videos.clips` en `es.json` (con `focalMobile`
y, si existe, `vertical`) y en la etapa como `{"clip": "<id>"}`, y correr `npm run videos`. Desktop 1280×720,
mobile 540×960 recortado de la horizontal sobre el punto focal (o 720×1280 si llega la vertical), 24 fps,
keyframe cada ½ s; si no entra en el presupuesto (≤ 1,4 MB desktop, ≤ 0,8 MB mobile) se espacian los keyframes
y, si aun así pierde calidad (SSIM < 0,95), el script lo avisa en lugar de forzarlo.
