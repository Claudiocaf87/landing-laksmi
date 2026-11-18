"""Genera public/assets/fotos/ a partir de assets-fuente/ (npm run imagenes).

- Fotos de etapa: desktop 1920 px de ancho (≤ 250 KB) y mobile en vertical 9:16 de 900 px de ancho (≤ 120 KB),
  en AVIF + WebP. El recorte vertical se centra en el punto focal definido en src/content/es.json
  (campo "focal", p. ej. "60% 40%"), así en mobile no se cortan caras ni manos.
- Persona con la caja: PNG con transparencia → AVIF/WebP con alfa, recortado al contenido.
- Rubros: tarjeta cuadrada. og: 1200×630 JPG.
- Sin metadatos (se copian solo los píxeles). Si una imagen no entra en el peso, se baja la calidad.
Requiere Pillow con AVIF (pip install pillow).
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-fuente"
OUT = ROOT / "public" / "assets" / "fotos"
CONTENT = json.loads((ROOT / "src" / "content" / "es.json").read_text(encoding="utf8"))
report = []


def clean(im, alpha=False):
    mode = "RGBA" if alpha else "RGB"
    out = Image.new(mode, im.size)
    out.paste(im.convert(mode))
    return out


def focal(f):
    x, y = (float(v.strip().rstrip("%")) / 100 for v in f.split())
    return x, y


def crop_ratio(im, ratio, fx, fy):
    """Recorta al aspecto pedido centrado (lo más posible) en el punto focal."""
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        x = min(max(round(fx * w - nw / 2), 0), w - nw)
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ratio)
    y = min(max(round(fy * h - nh / 2), 0), h - nh)
    return im.crop((0, y, w, y + nh))


def save_budget(im, dest, fmt, kb):
    """Guarda bajando la calidad hasta entrar en el presupuesto."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    q = 62 if fmt == "avif" else 82
    while True:
        kw = {"quality": q}
        kw.update({"method": 6} if fmt == "webp" else {"speed": 4})
        im.save(dest, fmt.upper(), **kw)
        size = dest.stat().st_size
        if size <= kb * 1024 or q <= 30:
            report.append((dest.relative_to(OUT).as_posix(), im.size, size, q))
            return
        q -= 4


def emit(im, name, kb):
    for fmt in ("avif", "webp"):
        save_budget(im, OUT / f"{name}.{fmt}", fmt, kb)


# fotos de etapa
for etapa in CONTENT["etapas"]:
    for f in etapa.get("fotos", []):
        src = SRC / f"{f['id']}.jpg"
        im = clean(Image.open(src))
        fx, fy = focal(f["focal"])
        desk = im if im.width <= 1920 else im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
        emit(desk, f"{f['id']}-desktop", 250)
        mob = crop_ratio(im, 9 / 16, fx, fy).resize((900, 1600), Image.LANCZOS)
        emit(mob, f"{f['id']}-mobile", 120)

# persona con la caja (con transparencia)
p = clean(Image.open(SRC / "persona-caja.webp"), alpha=True)
p = p.crop(p.getchannel("A").getbbox())
for name, hgt, kb in (("persona-caja-desktop", 1024, 160), ("persona-caja-mobile", 720, 90)):
    v = p if p.height <= hgt else p.resize((round(p.width * hgt / p.height), hgt), Image.LANCZOS)
    emit(v, name, kb)

# globo como imagen fija (capturado de la escena 3D con scripts/capturar-globo.mjs)
for cual in ("hero", "cierre"):
    src = SRC / f"globo-{cual}.png"
    if src.exists():
        g = clean(Image.open(src))
        emit(g.resize((900, 900), Image.LANCZOS), f"globo-{cual}-desktop", 120)
        emit(g.resize((600, 600), Image.LANCZOS), f"globo-{cual}-mobile", 60)

# rubros
for r in CONTENT["rubros"]["items"]:
    if not r.get("foto"):
        continue
    im = clean(Image.open(SRC / f"{r['foto']}.jpg"))
    sq = crop_ratio(im, 1, *focal(r["focal"]))
    emit(sq.resize((800, 800), Image.LANCZOS), f"{r['foto']}-desktop", 90)
    emit(sq.resize((480, 480), Image.LANCZOS), f"{r['foto']}-mobile", 45)

# vista previa para redes
og = crop_ratio(clean(Image.open(SRC / "transito.jpg")), 1200 / 630, 0.5, 0.55).resize((1200, 630), Image.LANCZOS)
og_path = ROOT / "public" / "assets" / "og" / "og-laksmi.jpg"
og_path.parent.mkdir(parents=True, exist_ok=True)
og.save(og_path, "JPEG", quality=82, optimize=True, progressive=True)

total = 0
for path, size, b, q in report:
    total += b
    print(f"{path:38} {size[0]:>5}x{size[1]:<5} {b / 1024:7.1f} KB  q{q}")
print(f"{'total fotos':38} {'':11} {total / 1024:7.1f} KB  (+ og {og_path.stat().st_size / 1024:.1f} KB)")
