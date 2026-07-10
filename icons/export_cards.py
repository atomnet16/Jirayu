#!/usr/bin/env python3
# ตัดพื้นขาวการ์ด 5 อัน -> PNG โปร่ง center 256 (ใช้ในแอปจริง)
import numpy as np
from PIL import Image, ImageFilter

IC = "C:/Users/Admin/Jirayu/icons"
SIZE, FILL = 256, 0.92
JOBS = [("CR-01.png","card-cr.png"), ("MX-01.png","card-mx.png"),
        ("SP-01.png","card-sp.png"), ("ST-01.png","card-st.png"),
        ("RT-01.png","card-rt.png")]

def reconstruct(seed, allow):
    bg = seed & allow
    while True:
        new = bg.copy()
        new[1:, :] |= bg[:-1, :]; new[:-1, :] |= bg[1:, :]
        new[:, 1:] |= bg[:, :-1]; new[:, :-1] |= bg[:, 1:]
        new &= allow
        if new.sum() == bg.sum(): break
        bg = new
    return bg

def cut_white(path, thr=222, sat=26):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16); h, w, _ = a.shape
    mn = a.min(2); mx = a.max(2)
    white = (mn > thr) & ((mx - mn) < sat)
    seed = np.zeros((h, w), bool)
    seed[0, :] |= white[0, :]; seed[-1, :] |= white[-1, :]
    seed[:, 0] |= white[:, 0]; seed[:, -1] |= white[:, -1]
    bg = reconstruct(seed, white)
    fg = ~bg
    border = np.zeros((h, w), bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    outside = reconstruct(border & ~fg, ~fg)
    fg |= (~fg) & (~outside)
    rgba = np.dstack([np.asarray(im).astype(np.uint8), (fg * 255).astype(np.uint8)])
    out = Image.fromarray(rgba, "RGBA")
    al = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.6)); out.putalpha(al)
    return out.crop(out.getbbox())

for src, dst in JOBS:
    ic = cut_white(f"{IC}/{src}")
    scale = (SIZE * FILL) / max(ic.size)
    nw, nh = max(1, round(ic.width*scale)), max(1, round(ic.height*scale))
    ic = ic.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(ic, ((SIZE-nw)//2, (SIZE-nh)//2), ic)
    canvas.save(f"{IC}/{dst}")
    print(f"{src:12} -> {dst}")
