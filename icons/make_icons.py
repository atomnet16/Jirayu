#!/usr/bin/env python3
# ตัดพื้นครีม/ขาว (morphological reconstruction จากขอบ) + autocrop + center บน canvas โปร่ง
import sys, numpy as np
from collections import deque
from PIL import Image, ImageFilter

RAW = "C:/Users/Admin/Jirayu/icons/raw"
OUT = "C:/Users/Admin/Jirayu/icons"
SIZE = 256
FILL = 0.86   # สัดส่วนความสูง/กว้างของวัตถุบน canvas

# input, output, mn_thr, sat_thr, fill_holes
# โลหะ (มีช่องโปร่ง) = ค่ากว้าง + ไม่ fill ; แก้ว = ค่าแคบ + fill เพื่อเก็บเนื้อแก้ว
JOBS = [
    ("Home.png",    "nav-home.png",     156, 52, False),
    ("Stock.png",   "nav-stock.png",    180, 40, True),
    ("Report.png",  "nav-reports.png",  180, 40, True),
    ("History.png", "nav-history.png",  156, 52, False),
    ("Setting.png", "nav-settings.png", 156, 52, False),
]

def bg_ref(a):
    h, w, _ = a.shape
    s = 14
    corners = np.concatenate([
        a[:s, :s].reshape(-1, 3), a[:s, -s:].reshape(-1, 3),
        a[-s:, :s].reshape(-1, 3), a[-s:, -s:].reshape(-1, 3),
    ])
    return np.median(corners, axis=0)

def reconstruct(seed, allow):
    # morphological reconstruction: โต seed ภายใน allow
    bg = seed & allow
    while True:
        new = bg.copy()
        new[1:, :]  |= bg[:-1, :]; new[:-1, :] |= bg[1:, :]
        new[:, 1:]  |= bg[:, :-1]; new[:, :-1] |= bg[:, 1:]
        new &= allow
        if new.sum() == bg.sum():
            break
        bg = new
    return bg

def remove_bg(path, mn_thr=178, sat_thr=42, fill=True):
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im)
    rgb = arr[..., :3].astype(np.int16); al = arr[..., 3]
    h, w, _ = rgb.shape
    opaque = al > 100               # raw พื้นนอกโปร่งอยู่แล้ว → opaque = แผ่นสวิตช์ + วัตถุ
    mn = rgb.min(axis=2); mx = rgb.max(axis=2)
    cream = opaque & (mn > mn_thr) & ((mx - mn) < sat_thr)   # แผ่นสวิตช์ครีม/ขาว/เทาอ่อน
    # seed = cream ที่ติดกับพื้นโปร่ง (ขอบแผ่นสวิตช์รอบนอก)
    trans = ~opaque
    adj = np.zeros((h, w), bool)
    adj[1:, :] |= trans[:-1, :]; adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]; adj[:, :-1] |= trans[:, 1:]
    plate = reconstruct(cream & adj, cream)    # แผ่นครีมที่เชื่อมจากขอบนอก
    fg = opaque & ~plate
    fg = largest_cc(fg)
    # ตัดเงาที่เกาะวัตถุด้วยสะพานบาง: erode หาแกน → keep largest → reconstruct คืนวัตถุเต็ม
    er = 4
    core = fg.copy()
    for _ in range(er):
        e = core.copy()
        e[1:, :] &= core[:-1, :]; e[:-1, :] &= core[1:, :]
        e[:, 1:] &= core[:, :-1]; e[:, :-1] &= core[:, 1:]
        core = e
    core = largest_cc(core)
    fg = reconstruct(core, fg)
    if fill:
        # เติมรูภายในวัตถุกลับ (เนื้อแก้วที่ถูกล้อมด้วยกรอบโลหะ) — เฉพาะภาพแก้ว
        border = np.zeros((h, w), bool)
        border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
        outside = reconstruct(border & ~fg, ~fg)
        holes = (~fg) & (~outside)
        fg = fg | holes
    return im.convert("RGB"), fg

def largest_cc(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    best = None; best_n = 0
    ys, xs = np.where(mask)
    idx = 0
    for i in range(len(ys)):
        y0, x0 = ys[i], xs[i]
        if seen[y0, x0]:
            continue
        comp = []
        dq = deque([(y0, x0)]); seen[y0, x0] = True
        while dq:
            y, x = dq.popleft(); comp.append((y, x))
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                ny, nx = y+dy, x+dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; dq.append((ny, nx))
        if len(comp) > best_n:
            best_n = len(comp); best = comp
    out = np.zeros((h, w), bool)
    for y, x in best:
        out[y, x] = True
    return out

def compose(im, fg):
    a = np.dstack([np.asarray(im).astype(np.uint8), (fg * 255).astype(np.uint8)])
    rgba = Image.fromarray(a, "RGBA")
    # feather ขอบเล็กน้อยให้เนียน
    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(alpha)
    bbox = rgba.getbbox()
    rgba = rgba.crop(bbox)
    # วางกลาง square canvas
    ow, oh = rgba.size
    scale = (SIZE * FILL) / max(ow, oh)
    nw, nh = max(1, round(ow * scale)), max(1, round(oh * scale))
    rgba = rgba.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(rgba, ((SIZE - nw) // 2, (SIZE - nh) // 2), rgba)
    return canvas

def main():
    for src, dst, mn, sat, fill in JOBS:
        im, fg = remove_bg(f"{RAW}/{src}", mn, sat, fill)
        out = compose(im, fg)
        out.save(f"{OUT}/{dst}")
        print(f"{src:14} -> {dst:18} fg_px={int(fg.sum()):>7}  mn={mn} sat={sat} fill={fill}")

if __name__ == "__main__":
    main()
