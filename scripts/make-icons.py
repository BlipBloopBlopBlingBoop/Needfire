#!/usr/bin/env python3
"""Generate the PWA raster icons (web/assets/icon-*.png) from Needfire glyph.

Pure stdlib (zlib + struct) so the icons are reproducible on any machine with
Python 3 — no image libraries, no binary blobs of unknown origin. Re-run after
changing the glyph:  python3 scripts/make-icons.py
"""
import struct
import zlib
from pathlib import Path

BG = (0x0D, 0x11, 0x17)      # --bg-2, matches theme_color
AMBER = (0xF5, 0xA6, 0x23)   # --accent

# The glyph from web/assets/logo.svg in a 24x24 viewbox: the needfire — a
# flame with three rising sparks. The smooth SVG curve is approximated here
# as a dense closed polyline (the renderer strokes line segments).
_FLAME = [
    (12.0, 21.6), (9.6, 21.1), (7.6, 19.6), (6.4, 17.6), (6.0, 15.6),
    (6.3, 13.4), (7.3, 11.5), (8.7, 9.7), (10.0, 7.8), (10.9, 5.8),
    (11.6, 7.2), (12.0, 9.0), (11.9, 10.7), (11.4, 12.3),
    (12.9, 11.5), (14.0, 10.2), (14.6, 8.6),
    (16.0, 10.2), (17.1, 12.1), (17.8, 14.2), (17.9, 16.2),
    (17.2, 18.4), (15.7, 20.3), (13.8, 21.3), (12.0, 21.6),
]
SEGMENTS = [(_FLAME[i], _FLAME[i + 1]) for i in range(len(_FLAME) - 1)]
# sparks: zero-length segments render as round dots
SEGMENTS += [((12.0, 2.2), (12.0, 2.2)),
             ((7.2, 4.4), (7.2, 4.4)),
             ((16.8, 4.4), (16.8, 4.4))]
STROKE = 1.7  # viewbox units


def _dist_to_segment(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    cx, cy = ax + t * dx, ay + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def render(size, content_scale):
    """RGB pixel rows. content_scale <1 shrinks the glyph into the safe zone."""
    glyph_px = size * content_scale
    offset = (size - glyph_px) / 2.0
    scale = glyph_px / 24.0
    half = STROKE / 2.0
    rows = []
    for y in range(size):
        row = bytearray()
        vy = (y + 0.5 - offset) / scale
        for x in range(size):
            vx = (x + 0.5 - offset) / scale
            d = min(_dist_to_segment(vx, vy, a, b) for a, b in SEGMENTS)
            # antialiased coverage of the stroke at this pixel
            cov = max(0.0, min(1.0, (half - d) / (0.75 / scale) + 0.5))
            r = round(BG[0] + (AMBER[0] - BG[0]) * cov)
            g = round(BG[1] + (AMBER[1] - BG[1]) * cov)
            b = round(BG[2] + (AMBER[2] - BG[2]) * cov)
            row += bytes((r, g, b))
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    size = len(rows)

    def chunk(kind, data):
        c = struct.pack(">I", len(data)) + kind + data
        return c + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b"".join(b"\x00" + r for r in rows)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.write_bytes(png)
    print(f"  {path}  ({len(png)} bytes)")


def main():
    assets = Path(__file__).resolve().parent.parent / "web" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    write_png(assets / "icon-192.png", render(192, 0.78))
    write_png(assets / "icon-512.png", render(512, 0.78))
    # maskable: keep the glyph inside the central safe zone (~80% circle)
    write_png(assets / "icon-maskable-512.png", render(512, 0.58))


if __name__ == "__main__":
    main()
