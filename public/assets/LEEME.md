# Assets reemplazables

Mantené los nombres de archivo para no tocar código. En la fase 4 se completa esta guía con
medidas exactas, formatos y peso máximo de cada archivo, y la escena empieza a cargarlos.

| Carpeta | Qué va | Estado |
|---|---|---|
| `logo/` | `logo-color.webp/png`, `logo-blanco.webp/png`, `favicon.png` | ✅ en uso (generados del logo enviado) |
| `data/` | `globo-puntos.bin` (tierra del globo, Natural Earth, dominio público; se regenera con `npm run globo`) | ✅ en uso |
| `carteles/` | Fotos para los carteles del showroom y banderolas (horizontal 16:9) | fase 4 |
| `fotos/` | Fotos de oficinas, equipo, fábricas | fase 4 |
| `productos/` | Fotos de productos por rubro | fase 4 |
| `recortes/` | PNG con transparencia: persona abriendo la caja (`persona-caja.png`) | fase 4 |
| `video/` | Video corto en loop para la pantalla de la planta (`planta.mp4` + `planta.webm`) | fase 4 |
| `modelos/` | Modelos `.glb` opcionales | fase 4 |
| `fallback/` | Imágenes fijas por etapa para la versión sin 3D (`etapa-00.webp` … `etapa-08.webp`) | fase 4 |
