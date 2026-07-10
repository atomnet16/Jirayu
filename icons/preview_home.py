#!/usr/bin/env python3
# render mockup หน้า Home เป็นภาพ PNG (วางไอคอน 3D จริง 10 ภาพ)
import numpy as np
from collections import deque
from PIL import Image, ImageDraw, ImageFont, ImageFilter

IC = "C:/Users/Admin/Jirayu/icons"
S = 2                       # oversample
W, H = 430 * S, 764 * S

def reconstruct(seed, allow):
    bg = seed & allow
    while True:
        new = bg.copy()
        new[1:, :] |= bg[:-1, :]; new[:-1, :] |= bg[1:, :]
        new[:, 1:] |= bg[:, :-1]; new[:, :-1] |= bg[:, 1:]
        new &= allow
        if new.sum() == bg.sum():
            break
        bg = new
    return bg

def cut_white(path, thr=222, sat=26):
    # ตัดพื้นขาวการ์ด (flood จากขอบภาพในโซนขาว) -> โปร่ง + crop + center
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16); h, w, _ = a.shape
    mn = a.min(2); mx = a.max(2)
    white = (mn > thr) & ((mx - mn) < sat)
    seed = np.zeros((h, w), bool)
    seed[0, :] |= white[0, :]; seed[-1, :] |= white[-1, :]
    seed[:, 0] |= white[:, 0]; seed[:, -1] |= white[:, -1]
    bg = reconstruct(seed, white)
    fg = ~bg
    # fill holes ภายในวัตถุ
    border = np.zeros((h, w), bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    outside = reconstruct(border & ~fg, ~fg)
    fg |= (~fg) & (~outside)
    rgba = np.dstack([np.asarray(im).astype(np.uint8), (fg * 255).astype(np.uint8)])
    out = Image.fromarray(rgba, "RGBA")
    al = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.6)); out.putalpha(al)
    return out.crop(out.getbbox())

def fit(img, box):
    img = img.copy(); img.thumbnail((box, box), Image.LANCZOS); return img

def font(sz, bold=False):
    for p in ([ "C:/Windows/Fonts/KhmerUIb.ttf" if bold else "C:/Windows/Fonts/KhmerUI.ttf",
                "C:/Windows/Fonts/leelawui.ttf",
                "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"]):
        try: return ImageFont.truetype(p, sz)
        except: pass
    return ImageFont.load_default()

def ctext(d, cx, y, s, f, fill, anchor="ma"):
    d.text((cx, y), s, font=f, fill=fill, anchor=anchor)

# พื้นหลัง mint gradient (สร้างคอลัมน์ 1px แล้ว stretch)
grad = Image.new("RGB", (1, H))
top, bot = (230, 242, 232), (211, 233, 217)
for y in range(H):
    t = y / H
    grad.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
img = grad.resize((W, H)).convert("RGBA")
d = ImageDraw.Draw(img)

def card(x, y, w, h, r, fillc=(255, 255, 255, 220), bd=(255, 255, 255, 235)):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.rounded_rectangle([x, y + 4 * S, x + w, y + h + 4 * S], r, fill=(90, 130, 100, 60))
    sh = sh.filter(ImageFilter.GaussianBlur(5 * S))
    img.alpha_composite(sh)
    d.rounded_rectangle([x, y, x + w, y + h], r, fill=fillc, outline=bd, width=S)

TXT, MUT = (44, 58, 48), (107, 125, 112)
fH, fK, fE, fP = font(16*S, 1), font(15*S, 1), font(11*S), font(12*S, 1)

# header
ctext(d, 22*S, 14*S, "Chemical Control", font(18*S, 1), TXT, "la")
ctext(d, 22*S, 38*S, "ថ្ងៃនេះ · 21 Jun", font(11*S), MUT, "la")

# stats
stats = [("3", "ស្នើ CR", (31,158,99)), ("5", "លាយ MX", (22,160,133)), ("4", "បាញ់ SP", (61,127,196))]
sx, sw, sg = 16*S, (W - 32*S - 16*S) // 3, 8*S
for i, (v, l, c) in enumerate(stats):
    x = sx + i * (sw + sg)
    card(x, 60*S, sw, 52*S, 12*S)
    ctext(d, x + sw//2, 66*S, v, font(24*S, 1), c)
    ctext(d, x + sw//2, 94*S, l, font(11*S), MUT)

ctext(d, 22*S, 124*S, "ទម្រង់ · FORMS", font(11*S, 1), MUT, "la")

# form cards (icon, khmer, english, code, color) — 2 คอลัมน์ ใหญ่ขึ้น ~2 เท่า
fK2, fE2, fP2 = font(18*S, 1), font(12*S), font(13*S, 1)
cards = [
    ("card-cr.png", "ការស្នើសុំ", "Requisition", "CR-01", (31,158,99),  (225,243,233)),
    ("card-mx.png", "ការលាយ",   "Mixing",      "MX-01", (22,160,133), (220,242,236)),
    ("card-sp.png", "ការបាញ់",   "Spraying",    "SP-01", (61,127,196), (224,236,248)),
    ("card-st.png", "ការទទួល",   "Stock In",    "ST-01", (107,95,208), (230,227,248)),
    ("card-rt.png", "ការសងវិញ",  "Return",      "RT-01", (184,132,58), (248,238,220)),
]
cw = (W - 32*S - 12*S) // 2
ch = 178*S
gy0 = 138*S
for i, (icon, kh, en, code, col, pill) in enumerate(cards):
    last_odd = (i == len(cards) - 1) and (len(cards) % 2 == 1)
    cx = (W - cw) // 2 if last_odd else 16*S + (i % 2) * (cw + 12*S)
    cy = gy0 + (i // 2) * (ch + 12*S)
    card(cx, cy, cw, ch, 18*S)
    ic = fit(Image.open(f"{IC}/{icon}").convert("RGBA"), 80*S)
    img.alpha_composite(ic, (cx + (cw - ic.width)//2, cy + 12*S))
    ctext(d, cx + cw//2, cy + 100*S, kh, fK2, TXT)
    ctext(d, cx + cw//2, cy + 122*S, en, fE2, MUT)
    d.rounded_rectangle([cx+12*S, cy+ch-30*S, cx+cw-12*S, cy+ch-9*S], 9*S, fill=pill)
    ctext(d, cx + cw//2, cy + ch - 27*S, code, fP2, col)

# bottom nav
navs = [("nav-home.png","Home",(31,158,99)), ("nav-stock.png","Stock",(168,130,74)),
        ("nav-reports.png","Reports",(168,130,74)), ("nav-history.png","History",(168,130,74)),
        ("nav-settings.png","Settings",(168,130,74))]
nb_y = H - 56*S
card(16*S, nb_y, W - 32*S, 47*S, 16*S, fillc=(255,255,255,235))
nbw = (W - 32*S) // 5
for i, (icon, lbl, col) in enumerate(navs):
    cx = 16*S + i * nbw + nbw//2
    ic = fit(Image.open(f"{IC}/{icon}").convert("RGBA"), 31*S)
    img.alpha_composite(ic, (cx - ic.width//2, nb_y + 5*S))
    ctext(d, cx, nb_y + 36*S, lbl, font(10*S, 1), col)

img.convert("RGB").save(f"{IC}/_preview_home.png")
print("saved", f"{IC}/_preview_home.png", img.size)
