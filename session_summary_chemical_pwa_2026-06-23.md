# Sprayer App (Chemical Control PWA) — สรุปฉบับสมบูรณ์ 2026-06-23

> ไฟล์นี้ใช้เริ่ม Session ใหม่ — attach ตอนเปิดแชทใหม่
> เวอร์ชันปัจจุบัน: **APP v12.06.23a / SW v34** · commit ล่าสุด `fa86679`
> GAS deployed ✅ (2026-06-23)

---

## 1. ภาพรวมโปรเจกต์

| รายการ | ค่า |
|--------|-----|
| ชื่อ | Chemical Control PWA (Sprayer App) — Mega Farm Cambodia |
| ไฟล์หลัก | `C:\Users\Admin\Jirayu\index.html` (single-file PWA) |
| Service Worker | `C:\Users\Admin\Jirayu\sw.js` (**chemcontrol-v34**) |
| GAS (local) | `C:\Users\Admin\Jirayu\Code_full.gs` |
| ไอคอน 3D | `C:\Users\Admin\Jirayu\icons\` (card-*.png, nav-*.png ใช้จริง) |
| Deploy frontend | GitHub Pages → `https://atomnet16.github.io/Jirayu/` |
| Repo | `https://github.com/atomnet16/Jirayu` (branch `main`) |
| Backend | Google Apps Script "Chemical stock on real time" |
| GAS Sheet | "Chemical Control Records - Mega Farm" (`1j3KleOE--ZOJjK3I9PyXkyQj5_NJ3oQdJYzRmuzMKQU`) |
| ผู้ใช้ | Jirayu (atomnet16@gmail.com) — **ตอบภาษาไทย**, Windows 10 PowerShell |

### GAS SCRIPT_URL (ห้ามเปลี่ยน Deployment ID)
```
https://script.google.com/macros/s/AKfycbw-hyf7Qbz0Wsk-J8d1eY_13qVtcbAAGDLQ27RLN9dzSfY9ETxzRBtR1fUOJiL4mb0/exec
```
Deploy GAS ใหม่ = ✏️ Edit deployment เดิม → New version (ห้ามสร้าง New deployment)

---

## 2. สถาปัตยกรรม

- **Sheets:** CR-01 (เบิก) · MX-01 (ผสม/พ่น) · SP-01 (ปฏิบัติงาน) · ST-01 (รับเข้า) · RT-01 (คืน) · STOCK_INIT · DATA AN · DELETED
- **Actions:** getAll (doGet/JSONP) · append · update · appendMany · delete (doPost no-cors)
- **Sync:** `cloudSync()` ทุก 20 วิ — push ทุก record ขึ้น `appendMany` แล้ว getAll มา merge
- **Edit:** `handleSave` edit → `action:'update'` (overwrite ตรง) + edit ledger (`mf_edit_ledger`, 30 นาที)
- **timestamp ทุกตัวเป็น ISO UTC** (`toISOString()`) — ⚠️ ห้ามเขียน format อื่นลง sheet

---

## 3. งานทั้งหมดใน Session นี้ (2026-06-23) ✅ ทำเสร็จและ Deploy แล้ว

### A. Report By Plot — Accordion (commit 28e6c31)
- ตัด `<select>` filter ทีละแปลงออก → **แสดงทุก Plot พร้อมกัน** เป็น accordion
- แต่ละ Plot พับไว้ (default) — คลิกหัวข้อกาง/พับรายละเอียด
- ปุ่ม **Expand All / Collapse All** · label ภาษาอังกฤษ

### B. Dropdown ไม่ปิดเองเมื่อ cloudSync() re-render (commit 28e6c31)
- เพิ่ม `rptPlotOpen` เก็บ state ทั้ง 3 ชั้น (Plot / Total Chemicals / รายวัน)
- `toggleRptPlot()` ชั้น Plot, `toggleRptItem()` ชั้นใน → ไม่รีเซ็ตเมื่อ sync

### C. Crop Type ใน MX Form (commit fa86679)
- Optional dropdown: **Corn / Cassava / Soy Bean / Mung Bean**
- ไม่เลือก = default Corn · ข้อมูลเก่าทั้งหมด default Corn
- field `cropType` บันทึกใน MX record + Sheet column `CropType`

### D. Production Season (commit fa86679)
- Settings page เพิ่ม card **🌾 Production Season**
- เปลี่ยน season ต้อง **PIN 9764**
- ลำดับ: `Rain / 26` → `Dry / 26` → `Rain / 27` → `Dry / 27` ...
- เก็บใน `localStorage` key `mf_current_season` · default `Rain Season / 26`
- record ใหม่ทุกตัวติด `season` อัตโนมัติ · ข้อมูลเก่า default `Rain Season / 26`

### E. Report — Season Filter + Crop Badge (commit fa86679)
- Season filter dropdown กรองข้อมูลตามฤดูกาล
- หัวข้อ Plot แสดง crop emoji (🌽🌿🫘🟢)
- Stage badge: Corn → 🌽 V6·D67 · crop อื่น → emoji + D{days}

### F. GAS Deploy ✅ (2026-06-23)
- SCHEMA MX-01 เพิ่ม column `CropType` + `Season`
- `getFieldValue()` map `cropType`, `season`
- Deploy แล้ว — Sheet MX-01 รับ column ใหม่ได้แล้ว

---

## 4. SCHEMA MX-01 ปัจจุบัน (14 fixed columns)
```
ID · Date · Time · Mixer · Plot · Sprayer ·
WaterPerTank · TotalWater · SprayType · CropType · Season · Note · CreatedAt · UpdatedAt
```
+ chemical columns ต่อท้าย (เพิ่มอัตโนมัติโดย appendChemicals)

---

## 5. STOCK_INIT (11 คอลัมน์)
`A Chemical · B Unit · C SnapQty · D SnapDate · E CR_Issued(auto) · F CalcQty(auto) · G PhysCount · H Variance(=G-F) · I CountDate · J Rate/Ha · K Remain(Ha)`
- แก้ยอดสต๊อก = แก้ Sheet **อย่ารัน** `seedStockInit()` ซ้ำ

---

## 6. State Variables สำคัญ
| Variable | localStorage key | Default |
|---|---|---|
| `currentSeason` | `mf_current_season` | `Rain Season / 26` |
| `rptPlotOpen` | memory only | `{}` |
| `rptSeasonFilter` | memory only | `'all'` |
| `ADMIN_PIN` | hardcoded | `9764` |

---

## 7. Crop Types
| Crop | Emoji | Stage |
|------|-------|-------|
| Corn | 🌽 | VE / V1–V15 / R1–R6 (STAGE_TABLE) |
| Cassava | 🌿 | D{days} เท่านั้น |
| Soy Bean | 🫘 | D{days} เท่านั้น |
| Mung Bean | 🟢 | D{days} เท่านั้น |

---

## 8. App Theme + Layout
- **light-mint-glass** (`--bg:#d4edd8`, glass blur card, badge พาสเทล) — ไม่มี switcher
- `#pg-report.on { zoom:1.5 }`
- Bottom nav: icon 45px · label 20px · `body padding-bottom:122px`
- Home: grid 2 คอลัมน์ · RT card จัดกลาง `.fcard.ctr`

---

## 9. หมายเหตุเทคนิค
- timestamp ต้องเป็น ISO UTC เสมอ (กัน bounce)
- MX chem columns = ชื่อเคมีล้วน; DATA AN มี `(Kg)/(L)` → `buildChemMap` reconstruct
- `sanitizeAllChems` กรอง `0 < v < 2000`
- GAS รันมือ: `backfillUpdatedAt()` · `fixMXfromDataAN()` · `updateMXStages()` · `updateStockInitCalc()`
- Season เปลี่ยนได้เฉพาะ Settings + PIN 9764

---

## 10. คำสั่ง git + validate + deploy
```bash
cd "C:\Users\Admin\Jirayu"
git add index.html sw.js Code_full.gs
git commit -m "..."
git push origin main
```
> แก้ index.html → bump **APP_VERSION** + **cache version ใน sw.js** (ครั้งหน้า v35)
> แก้ Code_full.gs → **deploy GAS** (Edit deployment → New version)

### Validate ก่อน commit
```bash
node --check sw.js && echo "SW OK"
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let big=m.map(s=>s.replace(/<\/?script>/g,'')).join('\n;\n');try{new Function(big);console.log('JS OK')}catch(e){console.log('ERR '+e.message)}"
```

---

_อัปเดต 2026-06-23 · APP v12.06.23a / SW v34 · GAS deployed ✅ · Accordion + Crop Type + Season_
