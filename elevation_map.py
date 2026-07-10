"""
Elevation Map Generator — Mega Farm Cambodia
Input : -25-6-2569-dsm.tif  (EPSG:32648, res=5cm, area~7.38ha)
Output: elevation_map.tif   (GeoTIFF classified — เปิดใน QGIS ได้)
        elevation_map.png   (PNG + colorbar + legend)
        elevation_stats.txt (สรุปพื้นที่ ha แต่ละระดับ)
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import BoundaryNorm, ListedColormap
import rasterio
from rasterio.transform import from_bounds
import os, sys

# ─── CONFIG ───────────────────────────────────────────────────────────────────
INPUT_DSM  = r"C:\Users\Admin\OneDrive\Desktop\-25-6-2569-dsm.tif"
OUT_TIF    = r"C:\Users\Admin\OneDrive\Desktop\elevation_map.tif"
OUT_PNG    = r"C:\Users\Admin\OneDrive\Desktop\elevation_map.png"
OUT_STATS  = r"C:\Users\Admin\OneDrive\Desktop\elevation_stats.txt"

# แบ่งตามข้อมูลจริง: min=165.8m  max=244.6m  range=78.75m
# 8 ระดับ ทุก 10m (ครอบคลุมช่วง 165–245m)
FIXED_BREAKS = [165, 170, 180, 190, 200, 210, 220, 230, 245]

# ─── READ DSM ─────────────────────────────────────────────────────────────────
if not os.path.exists(INPUT_DSM):
    sys.exit(f"[ERROR] ไม่พบไฟล์ {INPUT_DSM}")

with rasterio.open(INPUT_DSM) as src:
    dsm    = src.read(1).astype(np.float32)
    meta   = src.meta.copy()
    nodata = src.nodata
    transform = src.transform
    crs    = src.crs
    pixel_area_m2 = abs(transform.a * transform.e)   # m²/pixel

# mask nodata
if nodata is not None:
    dsm = np.where(dsm == nodata, np.nan, dsm)

valid = dsm[~np.isnan(dsm)]
elev_min = float(np.nanmin(valid))
elev_max = float(np.nanmax(valid))
elev_mean = float(np.nanmean(valid))
print(f"Elevation  min={elev_min:.2f}m  max={elev_max:.2f}m  mean={elev_mean:.2f}m")

# ─── CLASSIFY ─────────────────────────────────────────────────────────────────
if FIXED_BREAKS:
    breaks = FIXED_BREAKS
else:
    # แบ่ง 7 ระดับ เท่ากัน
    breaks = np.linspace(elev_min, elev_max, 8).tolist()

breaks = sorted(set(breaks))
n_class = len(breaks) - 1

# สีจาก ต่ำ→สูง: น้ำเงิน→เขียว→เหลือง→ส้ม→แดง
colors = plt.cm.RdYlGn_r(np.linspace(0.05, 0.95, n_class))
cmap   = ListedColormap(colors)
norm   = BoundaryNorm(breaks, ncolors=n_class)

# classify raster
classified = np.digitize(dsm, bins=breaks[1:-1])   # 0..n_class-1
classified = np.where(np.isnan(dsm), -1, classified)

# ─── EXPORT GeoTIFF (classified) ──────────────────────────────────────────────
meta.update(dtype="int16", count=1, nodata=-1)
with rasterio.open(OUT_TIF, "w", **meta) as dst:
    dst.write(classified.astype("int16"), 1)
print(f"[OK] GeoTIFF saved → {OUT_TIF}")

# ─── AREA STATS ───────────────────────────────────────────────────────────────
lines = ["Elevation Class Statistics — Mega Farm Cambodia", "=" * 50]
total_ha = 0.0
class_stats = []
for i in range(n_class):
    lo, hi = breaks[i], breaks[i + 1]
    px = int(np.sum(classified == i))
    ha = px * pixel_area_m2 / 10_000
    total_ha += ha
    label = f"{lo:.1f}–{hi:.1f} m"
    class_stats.append((label, ha, colors[i]))
    lines.append(f"  Class {i+1:2d}  {label:>18}  {ha:8.2f} ha")

lines.append("-" * 50)
lines.append(f"  Total                           {total_ha:8.2f} ha")
stats_text = "\n".join(lines)
print(stats_text)

with open(OUT_STATS, "w", encoding="utf-8") as f:
    f.write(stats_text)
print(f"[OK] Stats saved → {OUT_STATS}")

# ─── PNG MAP ──────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 10))
fig.patch.set_facecolor("#1a1a2e")
ax.set_facecolor("#1a1a2e")

# plot classified map
masked = np.ma.masked_where(classified == -1, classified)
im = ax.imshow(masked, cmap=cmap, norm=norm, interpolation="bilinear")

# colorbar
cb = plt.colorbar(im, ax=ax, fraction=0.03, pad=0.02, orientation="vertical")
cb.set_label("ความสูง (เมตร)", color="white", fontsize=11)
cb.ax.yaxis.set_tick_params(color="white")
plt.setp(cb.ax.yaxis.get_ticklabels(), color="white", fontsize=9)
cb.set_ticks(breaks)
cb.set_ticklabels([f"{b:.1f}" for b in breaks])

# legend patches
patches = [
    mpatches.Patch(color=c, label=f"{lbl}  ({ha:.1f} ha)")
    for lbl, ha, c in class_stats
]
leg = ax.legend(
    handles=patches, loc="lower left", framealpha=0.7,
    facecolor="#0d0d1a", edgecolor="#555", labelcolor="white",
    fontsize=8.5, title="ระดับความสูง", title_fontsize=9,
)
leg.get_title().set_color("white")

# title & axis
ax.set_title(
    "Elevation Map — Mega Farm Cambodia (25 June 2026)\n"
    f"DSM GSD 1.83 cm  |  Area ~55 ha  |  EPSG:32648",
    color="white", fontsize=13, pad=12,
)
ax.tick_params(colors="white", labelsize=8)
for spine in ax.spines.values():
    spine.set_edgecolor("#555")

plt.tight_layout()
plt.savefig(OUT_PNG, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
plt.close()
print(f"[OK] PNG saved → {OUT_PNG}")
print("\nDone! ✅")
