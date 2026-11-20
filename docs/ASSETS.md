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

## Fotos (en `public/assets/fotos/`)

Todas las etapas usan clips de video: su póster (`video-<id>-desktop|mobile`) lo genera `npm run videos`
a partir de la foto original (`assets-fuente/<foto>.jpg`) o del primer cuadro. Las fotos sueltas que quedan son:

| Archivo (`<id>-desktop|mobile.avif|webp`) | Etapa | Punto focal | Desktop | Mobile |
|---|---|---|---|---|
| `globo-hero` · `globo-cierre` | 00 y 09, solo sin WebGL / ahorro de datos / gama baja (capturas del globo 3D) | — | 900×900 | 600×600 |
| `rubro-automotriz` | Bloque Rubros (cuadrada) | 47% 50% | 800×800 | 480×480 |
| `rubro-ferreteria` | Bloque Rubros (cuadrada, foto de stock del cliente) | 50% 50% | 800×800 | 480×480 |
| `rubro-medico` | Bloque Rubros (cuadrada, foto de stock del cliente) | 36% 50% | 800×800 | 480×480 |
| `rubro-bisuteria` | Bloque Rubros (cuadrada, foto de stock del cliente) | 50% 50% | 800×800 | 480×480 |
| `rubro-tecnologia` | Bloque Rubros (cuadrada, foto de stock del cliente) | 45% 55% | 800×800 | 480×480 |

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
| Fotos reales del equipo en la Feria de Cantón | Para las etapas de ferias y negociación, con leyenda [FERIA, AÑO, QUIÉN ES] | ≥ 2000 px de ancho |
| `assets-fuente/videos/<archivo>_vertical.mp4` | Versiones verticales de feria, puerto y tránsito (reemplazan el recorte de la horizontal) | 720×1280 o más, 24 fps |
| `logo/logo.svg` | Logo vectorial (color y blanco) | SVG |

## Modo video

Clips generados con IA, sin audio: no muestran al equipo, a clientes ni a lugares reales de Laksmi.
Cada clip: `video/<id>-{desktop,mobile}.av1.mp4` (AV1, primera opción) y `.mp4` (H.264, respaldo); póster en
`fotos/video-<id>-{desktop,mobile}.{avif,webp}` (la foto original alineada con el primer cuadro, o el primer cuadro).

| Clip | Desktop | AV1 / H.264 desktop | AV1 / H.264 mobile (540×960) | Tramo |
|---|---|---|---|---|
| plan | 1920×1080 | 2,32 / 2,32 MB | 0,72 / 0,74 MB | completo (5 s) |
| feria | 1920×1080 | 2,30 / 2,36 MB | 0,78 / 0,75 MB | 3,3 a 8,3 s |
| negociacion | 1920×1080 | 1,40 / 1,69 MB | 0,34 / 0,41 MB | 0 a 2,9 s |
| calidad | 1920×1080 | 1,07 / 1,48 MB | 0,39 / 0,44 MB | 0 a 2,5 s |
| carga | 1920×1080 | 2,31 / 2,32 MB | 0,73 / 0,73 MB | completo (5 s) |
| precinto | 1920×1080 (nativo) | 2,39 / 2,39 MB | 0,73 / 0,76 MB | completo (5 s) |
| puerto | 1920×1080 | 2,33 / 2,34 MB | 0,70 / 0,74 MB | completo (5 s) |
| transito | 1280×720 | 2,42 / 2,33 MB | 0,75 / 0,76 MB | completo (10 s) |
| aduana | 1920×1080 | 2,18 / 2,31 MB | 0,72 / 0,74 MB | completo (5 s) |
| entrega | 1920×1080 | 2,20 / 2,32 MB | 0,71 / 0,74 MB | completo (5 s) |
| tienda | 1920×1080 (nativo) | 2,34 / 2,37 MB | 0,71 / 0,74 MB | 0 a 4 s |

Desktop: los clips 720p pasan a 1080p con lanczos y un enfoque leve si entran en 2,5 MB con buena calidad
(AV1 con CRF ≤ 36); si no (tránsito: el agua necesitaría CRF 46), quedan en 720p con enfoque. `--escalar` usa
Real-ESRGAN (realesrgan-x4plus) en la GPU; en esta máquina (Radeon integrada) tarda unos 85 s por cuadro y en
caras da un aspecto plástico, así que no se usa por defecto (`"escalar": false` lo desactiva por clip).

Para sumar un clip: dejarlo en `assets-fuente/videos/`, agregarlo a `videos.clips` en `es.json` (con `focalMobile`,
`foto` si salió de una foto, y `vertical` cuando exista) y en la etapa como `{"clip": "<id>"}`, y correr `npm run videos`.
Las versiones verticales (nombre en `videos.clips[].vertical` de es.json) reemplazan al recorte de la horizontal:
1080×1920 o 720×1280, 24 fps, se publican a 720×1280. Se usan completas; para recortarlas, `desdeVertical` y
`duracionVertical`. El póster de mobile sale del vertical (o de `<foto>-vertical.jpg` alineada, si existe).

