# Assets reemplazables

Mantené los nombres de archivo para no tocar código. Los textos alternativos están en
`src/content/es.json → imagenes`. Para regenerar las versiones optimizadas a partir de los
originales (`assets-fuente/`, fuera de git): `python scripts/optimizar-imagenes.py`.

**Reglas generales**
- Cada imagen va en dos tamaños: `-desktop` y `-mobile`. Las de HTML, en `.avif` + `.webp`.
  Las texturas del 3D, solo en `.webp`.
- Nada de esto se carga en el hero. Las texturas 3D se piden después del primer fotograma y las de
  HTML con `loading="lazy"`. Así la carga inicial no cambia (hoy, ~230 KB gzip de código + 21 KB de datos 3D).
- Sin metadatos: el script los borra (los exports de Canva traen nombre del autor e IDs de documento).
- Nunca agrandar: si el original es chico, se publica a su tamaño.

## Estado actual

| Archivo | Uso | Medida | Peso máx. | Estado |
|---|---|---|---|---|
| `logo/logo-blanco.webp/png` | Header, loader, footer | 410×234 | 40 KB | ✅ |
| `logo/logo-color.webp/png` | Fondos claros | 410×234 | 60 KB | ✅ (falta versión SVG) |
| `logo/favicon.png` | Pestaña | 64×64 | 10 KB | ✅ |
| `og/og-laksmi.jpg` | Vista previa al compartir (redes, WhatsApp) | 1200×630 | 200 KB | ✅ muestra |
| `data/globo-puntos.bin` | Tierra del globo (Natural Earth, dominio público; `npm run globo`) | — | 40 KB | ✅ |
| `carteles/cartel-01-{desktop,mobile}.webp` | Cartel de stand en el showroom (etapa 02) | 512×288 / 384×216 | 60 KB | ✅ muestra (ideal 1024×576) |
| `carteles/cartel-02-{desktop,mobile}.webp` | Cartel de stand en el showroom (etapa 02) | 512×288 / 384×216 | 60 KB | ✅ muestra (ideal 1024×576) |
| `fallback/etapa-02-*.{avif,webp}` | Versión sin 3D, etapa 02 | 512² / 384² | 120 KB | ✅ muestra (ideal 1200×675) |
| `fallback/etapa-04-*.{avif,webp}` | Versión sin 3D, etapa 04 | 512² / 384² | 120 KB | ✅ muestra (ideal 1200×675) |
| `fallback/etapa-05-*.{avif,webp}` | Versión sin 3D, etapa 05 | 1200×675 / 640×360 | 120 KB | ✅ muestra |
| `fallback/etapa-06-*.{avif,webp}` | Versión sin 3D, etapa 06 | 512² / 384² | 120 KB | ✅ muestra (ideal 1200×675) |

## Lo que falta (con medidas)

| Archivo | Qué tiene que mostrar | Medida y formato | Peso máx. |
|---|---|---|---|
| `recortes/persona-caja.png` | Una persona real (cliente o equipo, con permiso de imagen) abriendo una caja de cartón, de cuerpo entero o de rodillas, vista 3/4, **fondo eliminado**, luz lateral suave. | 1000×2000 px (1:2 vertical), PNG con transparencia; se publica como `.webp` con alfa | 250 KB (webp) |
| `video/planta.mp4` + `video/planta.webm` | Toma real del equipo en una fábrica o inspeccionando mercancía en China. Loop sin corte visible, **sin audio**, sin texto sobreimpreso. | 1280×720 (16:9), 8–15 s, 24/30 fps; MP4 H.264 ~1,5 Mbps + WebM VP9 | 2,5 MB (mp4) / 2 MB (webm) |
| `video/planta-poster.webp` | Primer fotograma del video (se muestra mientras carga) | 1280×720 | 80 KB |
| `carteles/cartel-03` … `cartel-10` | Stands en Feria de Cantón o Mercado de Yiwu, productos por rubro, oficinas en China | 1024×576 (16:9) desktop · 512×288 mobile, WebP | 120 KB |
| `productos/<rubro>-{desktop,mobile}.webp` | Un producto por rubro: ferretería, médico, automotriz, bisutería, tecnología. Fondo neutro. | 800×800 / 480×480 | 90 KB |
| `fotos/equipo-*.webp`, `fotos/oficina-*.webp` | Equipo y oficinas reales (Caracas, Margarita, Yiwu, Guangzhou, Ningbo, Shantou) | 1600×1067 (3:2) / 800×533 | 220 KB |
| `fotos/testimonio-<nombre>.webp` | Retrato de cada testimonio (solo con permiso) | 400×400 | 40 KB |
| `fallback/etapa-00, 01, 03, 07, 08` | Imagen fija por etapa para la versión sin 3D. Se pueden generar como capturas de la propia escena 3D en la fase 4. | 1200×675 / 640×360 | 120 KB |
| `logo/logo.svg` | Logo vectorial (versión color y blanca) | SVG | 30 KB |
