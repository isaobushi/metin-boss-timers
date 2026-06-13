#!/usr/bin/env python3
"""DragonsAid app-icon compositor.

Takes a transparent-background dragon-head PNG and composites it onto the
brand dark plate (rounded square, line hairline border, ember glow), then
writes icon-source.png at 1024x1024 — the single source for `tauri icon`.

Usage:
    python3 brand/build-icon.py <head.png> [--fill panel|bg] [--out icon-source.png]
    npx tauri icon brand/icon-source.png   # regenerates src-tauri/icons/*

Requires Pillow + numpy.
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# brand/tokens.css
PANEL = (20, 16, 31, 255)       # --da-panel  #14101f
BG = (10, 8, 16, 255)           # --da-bg     #0a0810
LINE = (44, 36, 64, 255)        # --da-line   #2c2440
EMBER = (255, 107, 44)          # --da-ember  #ff6b2c
EMBER_HOT = (255, 161, 74)      # --da-ember-hot #ffa14a

S = 1024            # output canvas
HEAD_FILL = 0.78    # head height as fraction of plate
RADIUS = S // 5     # plate corner radius
BORDER = 6          # hairline border width at 1024


def tight_head(path):
    """Load head art and crop to its alpha bounding box."""
    img = Image.open(path).convert('RGBA')
    alpha = np.array(img)[:, :, 3]
    ys, xs = np.where(alpha > 20)
    return img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def build(head_path, fill, out):
    head = tight_head(head_path)
    plate = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(plate)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=fill)
    d.rounded_rectangle([2, 2, S - 3, S - 3], radius=RADIUS, outline=LINE, width=BORDER)

    # warm ember glow behind the head
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse([S * 0.22, S * 0.20, S * 0.78, S * 0.76], fill=EMBER + (75,))
    dg.ellipse([S * 0.34, S * 0.32, S * 0.66, S * 0.64], fill=EMBER_HOT + (55,))
    plate.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.11)))

    scale = (S * HEAD_FILL) / max(head.size)
    hw, hh = round(head.size[0] * scale), round(head.size[1] * scale)
    plate.alpha_composite(head.resize((hw, hh), Image.LANCZOS), ((S - hw) // 2, (S - hh) // 2))
    plate.save(out)
    print(f'wrote {out} ({S}x{S}, fill={"panel" if fill == PANEL else "bg"})')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('head', help='transparent-bg dragon head PNG')
    p.add_argument('--fill', choices=['panel', 'bg'], default='panel')
    p.add_argument('--out', default='brand/icon-source.png')
    a = p.parse_args()
    build(a.head, PANEL if a.fill == 'panel' else BG, a.out)
