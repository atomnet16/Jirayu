# Chem Control · Mega Farm — สรุปงานทั้งหมด

- **URL:** https://atomnet16.github.io/Jirayu/
- **Version:** v12.06.26b
- **วันที่:** 19 มิ.ย. 2026

---

## ส่วนที่ 1 — ตรวจสอบการทำงาน (App Review)

### สถานะโดยรวม: ✅ ทำงานปกติ

**Dashboard วันนี้ (2026-06-19)**
- พ่นสาร 4 รอบ / 47.4 ha
- Stock บนรถ: คงเหลือ 1% (เกือบหมด)
- Stock คลัง: คงเหลือ 98%
- Auto sync ทุก 20 วินาที

**ข้อมูลในระบบ**
| ประเภท | จำนวน |
|--------|-------|
| CR Requisition | 25 |
| MX Mixing | 51 |
| SP Spraying | 47 |
| RT Return | 2 |
| ST Stock In | 0 |
| **รวม** | **125 รายการ** |

**ฟอร์มทั้ง 5 — ✅ ครบและใช้งานได้**
- CR-01: วันที่, ผู้ขอ, ผู้อนุมัติ, รายการสารเคมี
- MX-01: วันที่, เวลา, ผู้ผสม, แปลง, เครื่องพ่น (4 ตัว), น้ำ/ถัง, สารเคมี
- SP-01: วันที่, เวลาเริ่ม/จบ, ผู้พ่น, แปลง, ha, อากาศ, ลม, ถังผสม, น้ำก่อน/หลัง + ดึง GPS อัตโนมัติ
- ST-01: วันที่, เลขที่ใบ, ผู้รับ, ผู้อนุมัติ, รายการสารเคมี
- RT-01: วันที่, เหตุผล, ผู้คืน, ผู้รับ, รายการสารเคมี

**Backend GAS**
- Server alive ✅ ตอบสนองใน ~2.7 วิ
- Sync ทำงาน ✅ (มีหลักฐาน delete สำเร็จ)
- SCRIPT_URL: hardcode ใน index.html (ไม่ใช่ rfApiUrl ใน localStorage)

**พบปัญหา**
| | ปัญหา | แก้แล้ว? |
|--|-------|---------|
| 🔴 | ไม่มี PWA / Service Worker | ✅ แก้แล้ว |
| 🔴 | ไม่มี manifest.json | ✅ แก้แล้ว |
| 🟡 | icon เป็นแค่ emoji SVG | ✅ แก้แล้ว |

---

## ส่วนที่ 2 — เพิ่ม PWA Offline Support

### ไฟล์ที่เพิ่ม/แก้ไข

**`manifest.json`** (ใหม่)
```json
{
  "name": "Chem Control · Mega Farm",
  "short_name": "Chem Control",
  "start_url": "/Jirayu/",
  "scope": "/Jirayu/",
  "display": "standalone",
  "background_color": "#080f18",
  "theme_color": "#080f18",
  "icons": [
    { "src": "icon.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

**`sw.js`** (ใหม่) — Service Worker
- Cache-first: index.html, manifest.json, icon.png, icon.svg, Google Fonts
- Network-only: GAS (script.google.com) — ไม่ cache เพราะ dynamic data
- Fallback offline: คืน index.html แทน เมื่อ network ล้มเหลว
- Cache name: `chemcontrol-v1`

**`index.html`** (แก้ `<head>`)
```html
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon.png">
<script>
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js');
    });
  }
</script>
```

**`icon.png`** — ไอคอน 512×512 จาก Microsoft Designer (ใบไม้ neon + โครงสร้างเคมี บนพื้น dark teal)
**`icon.svg`** — fallback SVG (leaf emoji บนพื้นดำ)

### ผลตรวจสอบหลัง deploy
```
manifest:        ✅ โหลดได้
Service Worker:  ✅ activated
Scope:           /Jirayu/
Cache:           chemcontrol-v1
Cached files:    /Jirayu/, index.html, manifest.json, icon.png, icon.svg
```

### ความสามารถหลัง PWA
- ✅ **Offline**: เปิดแอพได้แม้ไม่มีเน็ต (ใช้ข้อมูล localStorage เดิม)
- ✅ **Install**: Chrome แสดงปุ่ม "Add to Home Screen" อัตโนมัติ
- ✅ **App icon**: ไอคอนสวยงามเมื่อ install บนมือถือ/desktop
- ⚠️ Sync GAS ต้องมีเน็ต — ข้อมูลใหม่จะดึงเมื่อ online

---

## ส่วนที่ 3 — STOCK_INIT Update

### วิธีอัปเดตสต๊อกตั้งต้น (ทำซ้ำทุกรอบนับสต๊อก)

1. เปิด Google Sheet **"Sprayer APP Now"** → Sheet **STOCK_INIT**
2. แก้ไขคอลัมน์ที่จำเป็น:
   - **C — SnapQty**: ยอดสต๊อกจริงที่นับได้
   - **D — SnapDate**: วันที่ที่นับ (format: YYYY-MM-DD)
3. บันทึก Sheet
4. รอ **ไม่เกิน 20 วินาที** → แอพดึงค่าใหม่อัตโนมัติ (ไม่ต้องกดอะไร)

### คอลัมน์ทั้งหมดใน STOCK_INIT

| คอลัมน์ | ชื่อ | กรอกเอง | หมายเหตุ |
|---------|------|---------|---------|
| A | Chemical | — | ชื่อสาร (อย่าแก้) |
| B | Unit | — | หน่วย |
| **C** | **SnapQty** | ✅ | ยอดตั้งต้น (ค่าที่นับจริง) |
| **D** | **SnapDate** | ✅ | วันที่นับ |
| E | CR_Issued | auto | GAS คำนวณ (CR ที่เบิกหลัง SnapDate) |
| F | CalcQty | auto | = C − E |
| G | PhysCount | ✅ (optional) | นับจริงครั้งหลัง *(แค่ดูผลต่าง)* |
| H | Variance | auto | = G − F (−หาย / +เกิน) |
| I | CountDate | ✅ (optional) | วันที่นับ PhysCount |

> ⚠️ แก้แค่ G (PhysCount) อย่างเดียว **แอพไม่รับรู้** ต้องแก้ C และ D เสมอ

### Auto-sync mechanism
```
เปิดแอพ  →  sync ทันทีใน 1.5 วิ
              ↓
         loop ทุก 20 วิ  →  ดึง stockInit ใหม่จาก GAS
              ↓
         อัปเดต localStorage['mf_stock_init']
              ↓
         calcWarehouseStock() ใช้ค่าใหม่ทันที
```

---

## Git Commits (session นี้)

| Commit | รายละเอียด |
|--------|-----------|
| `21c7e88` | feat: add PWA support — manifest, sw.js, icon.svg |
| `06acdbf` | feat: update PWA icon to Designer.png |
