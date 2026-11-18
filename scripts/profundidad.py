"""Mapas de profundidad para el prototipo de zoom 2.5D (Depth Anything V2 Small, ONNX, en CPU).

Uso: python scripts/profundidad.py
Requiere: pip install onnxruntime pillow numpy · modelo en .cache/depth-anything-v2-small.onnx
(https://huggingface.co/onnx-community/depth-anything-v2-small, archivo onnx/model.onnx).

Salida: public/assets/profundidad/<id>-{desktop,mobile}.webp (gris: blanco = cerca).
Para que el parallax no deforme a las personas ni deje halos, el primer plano se dilata unos
píxeles (el borde del desplazamiento cae sobre el fondo) y después se suaviza.
"""
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
FOTOS = ROOT / "public" / "assets" / "fotos"
OUT = ROOT / "public" / "assets" / "profundidad"
OUT.mkdir(parents=True, exist_ok=True)
CONTENT = json.loads((ROOT / "src" / "content" / "es.json").read_text(encoding="utf8"))
IDS = [f["id"] for e in CONTENT["etapas"] if e["id"] in ("ferias", "negociacion", "calidad") for f in e["fotos"]]

sess = ort.InferenceSession(str(ROOT / ".cache" / "depth-anything-v2-small.onnx"), providers=["CPUExecutionProvider"])
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def depth(im, long_side=518):
    w, h = im.size
    s = long_side / max(w, h)
    W, H = (max(14, round(w * s / 14) * 14), max(14, round(h * s / 14) * 14))
    x = (np.asarray(im.convert("RGB").resize((W, H), Image.BICUBIC), dtype=np.float32) / 255 - MEAN) / STD
    x = x.transpose(2, 0, 1)[None]
    d = sess.run(None, {"pixel_values": x})[0][0]
    lo, hi = np.percentile(d, 2), np.percentile(d, 98)
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
    return Image.fromarray((d * 255).astype(np.uint8))


for fid in IDS:
    for tag, size in (("desktop", (512, 288)), ("mobile", (288, 512))):
        src = Image.open(FOTOS / f"{fid}-{tag}.webp")
        d = depth(src).resize(size, Image.BICUBIC)
        d = d.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3))
        dest = OUT / f"{fid}-{tag}.webp"
        d.save(dest, "WEBP", quality=82)
        print(f"{dest.name:30} {size[0]}x{size[1]}  {dest.stat().st_size / 1024:5.1f} KB")
