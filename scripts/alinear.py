"""Alinea una foto original con el primer cuadro de su clip (los clips se generaron a partir de esas fotos,
pero el modelo suele reencuadrar un poco: zoom y desplazamiento leves).

alinear(foto, cuadro) → caja (x0, y0, x1, y1) en píxeles de la foto que corresponde al cuadro 16:9.
Búsqueda en dos pasos (gruesa a baja resolución y fina) minimizando la diferencia media de luminancia
y de bordes. Sin dependencias fuera de Pillow y numpy.
"""
import numpy as np
from PIL import Image, ImageFilter


def _gray(im, size):
    g = im.convert("L").resize(size, Image.BILINEAR)
    e = g.filter(ImageFilter.FIND_EDGES)
    return np.asarray(g, np.float32), np.asarray(e, np.float32)


def _score(photo, box, ref_g, ref_e, size):
    g, e = _gray(photo.crop(box), size)
    return float(np.abs(g - ref_g).mean() + 0.5 * np.abs(e - ref_e).mean())


def alinear(foto: Image.Image, cuadro: Image.Image):
    fw, fh = cuadro.size
    ratio = fw / fh
    W, H = foto.size
    # punto de partida: "cover" centrado
    k0 = min(W / fw, H / fh)
    best = None
    for size, ks, offs, base in (
        ((320, 180), np.linspace(0.90, 1.0, 21), np.linspace(-0.05, 0.05, 21), None),
        ((640, 360), np.linspace(-0.01, 0.01, 11), np.linspace(-0.006, 0.006, 13), "fino"),
    ):
        ref_g, ref_e = _gray(cuadro, size)
        cands = []
        if base is None:
            for s in ks:
                k = k0 * s
                for ox in offs:
                    for oy in offs:
                        cands.append((k, W / 2 + ox * W, H / 2 + oy * H))
        else:
            k1, cx1, cy1 = best[1]
            for s in ks:
                for ox in offs:
                    for oy in offs:
                        cands.append((k1 * (1 + s), cx1 + ox * W, cy1 + oy * H))
        for k, cx, cy in cands:
            w2, h2 = fw * k / 2, fh * k / 2
            box = (cx - w2, cy - h2, cx + w2, cy + h2)
            if box[0] < -1 or box[1] < -1 or box[2] > W + 1 or box[3] > H + 1:
                continue
            sc = _score(foto, box, ref_g, ref_e, size)
            if best is None or sc < best[0]:
                best = (sc, (k, cx, cy))
    k, cx, cy = best[1]
    w2, h2 = fw * k / 2, fh * k / 2
    return (max(0, cx - w2), max(0, cy - h2), min(W, cx + w2), min(H, cy + h2)), best[0]


if __name__ == "__main__":
    import sys

    foto, cuadro = Image.open(sys.argv[1]), Image.open(sys.argv[2])
    print(alinear(foto, cuadro))
