"""Diagnóstico de calidad de los clips en desktop (python scripts/diagnostico-video.py plan puerto transito).

Para el primer cuadro (quieto) de cada clip, a 1920×1080 como se ve a pantalla completa:
  A · foto original alineada con el cuadro (referencia nítida)
  B · clip de origen sin recomprimir (720p, escalado como lo hace el navegador)
  C · clip codificado publicado (720p, escalado igual)
  y, si existen en .cache/diagnostico/, D · escalado con Real-ESRGAN y E · candidato nuevo.
Mide SSIM contra A y la nitidez (gradiente medio relativo a A): la pérdida de A→B es la de resolución
(y la re-generación del modelo de video); la de B→C, la de compresión.
Guarda docs/capturas/diagnostico-<clip>.jpg (lado a lado) y los cuadros 1920×1080 en docs/capturas/diagnostico/.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from alinear import alinear  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
C = json.loads((ROOT / "src" / "content" / "es.json").read_text(encoding="utf8"))
CLIPS = {c["id"]: c for c in C["videos"]["clips"]}
SRC = ROOT / "assets-fuente" / "videos"
OUT = ROOT / "docs" / "capturas" / "diagnostico"
CACHE = ROOT / ".cache" / "diagnostico"
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
FHD = (1920, 1080)


def frame(path, t=0.0):
    png = CACHE / "tmp.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(path), "-frames:v", "1", str(png)], check=True)
    return Image.open(png).convert("RGB")


def ssim(a, b):
    pa, pb = CACHE / "a.png", CACHE / "b.png"
    a.save(pa)
    b.save(pb)
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(pa), "-i", str(pb), "-lavfi", "ssim", "-f", "null", "NUL"], capture_output=True, text=True)
    return float(r.stderr.split("All:")[1].split()[0])


def sharp(im):
    g = np.asarray(im.convert("L"), np.float32)
    return float(np.abs(np.diff(g, axis=0)).mean() + np.abs(np.diff(g, axis=1)).mean())


def browser(im):
    # el navegador escala el video con un filtro bilineal
    return im.resize(FHD, Image.BILINEAR)


report = {}
for cid in sys.argv[1:] or ["plan", "puerto", "transito"]:
    clip = CLIPS[cid]
    t0 = float(clip.get("desde", 0))
    src = frame(SRC / clip["archivo"], t0)
    foto = Image.open(ROOT / "assets-fuente" / f"{clip['foto']}.jpg").convert("RGB")
    box, _ = alinear(foto, src)
    A = foto.crop(box).resize(FHD, Image.LANCZOS)
    panels = {"A · foto original": A, "B · clip de origen (720p)": browser(src)}
    pub = sorted((ROOT / "public" / "assets" / "video").glob(f"{cid}-desktop.*"))
    viejo = CACHE / f"{cid}-publicado.png"
    if viejo.exists():
        panels["C · codificado antes (720p, 1,4 MB)"] = browser(Image.open(viejo).convert("RGB"))
    for extra in sorted(CACHE.glob(f"{cid}-*.png")):
        name = extra.stem.split("-", 1)[1]
        if name == "publicado":
            continue
        im = Image.open(extra).convert("RGB")
        panels[name.replace("_", " ")] = im if im.size == FHD else browser(im)
    for p in pub:
        if p.suffix == ".mp4":
            im = frame(p, 0)
            panels[f"codificado ahora ({p.name}, {p.stat().st_size / 1024 / 1024:.2f} MB)"] = im if im.size == FHD else browser(im)
    r = {}
    for k, im in panels.items():
        im.save(OUT / f"{cid}-{k.split(' ')[0].replace('·', '')}-{len(r)}.png")
        r[k] = {"ssim_vs_A": round(ssim(A, im), 4), "nitidez_vs_A": round(sharp(im) / sharp(A), 3)}
    report[cid] = r
    # lado a lado: un recorte al 100 % (tal cual a 1920×1080) de la zona con más detalle
    g = np.asarray(A.convert("L").filter(ImageFilter.FIND_EDGES), np.float32)
    cw, ch = 560, 460
    best = max(((g[y : y + ch, x : x + cw].mean(), x, y) for y in range(0, 1080 - ch, 40) for x in range(0, 1920 - cw, 40)))
    _, x, y = best
    tiles = [im.crop((x, y, x + cw, y + ch)) for im in panels.values()]
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    head = 52
    sheet = Image.new("RGB", (cw * cols, (ch + head) * rows), "white")
    d = ImageDraw.Draw(sheet)
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("arial.ttf", 17)
    except OSError:
        font = None
    for i, (k, t) in enumerate(zip(panels, tiles)):
        cx, cy = (i % cols) * cw, (i // cols) * (ch + head)
        sheet.paste(t, (cx, cy + head))
        d.text((cx + 8, cy + 6), k, fill="black", font=font)
        d.text((cx + 8, cy + 28), f"SSIM {r[k]['ssim_vs_A']:.3f}  ·  nitidez {r[k]['nitidez_vs_A']:.2f} (foto = 1)", fill="#555", font=font)
    sheet.save(ROOT / "docs" / "capturas" / f"diagnostico-{cid}.jpg", quality=92)
    print(cid, json.dumps(r, ensure_ascii=False, indent=1))
(ROOT / "docs" / "diagnostico-video.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
