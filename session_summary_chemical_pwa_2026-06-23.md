# Sprayer App (Chemical Control PWA) — สรุปฉบับสมบูรณ์ 2026-06-23

> ไฟล์นี้ใช้เริ่ม Session ใหม่ — attach ตอนเปิดแชทใหม่
> เวอร์ชันปัจจุบัน: **APP v12.06.23a / SW v34** · commit ล่าสุด `fa86679`

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
- **timestamp ทุกตัวเป็น ISO UTC** (`toISOString()`) — ⚠️ ห้ามเขียน format อื่นลง sheet (ทำให้ bounce กลับมา)

---

## 3. งานที่ทำใน Session นี้ (2026-06-23)

### A. Report By Plot — Accordion ✅ (commit 28e6c31)
- **เปลี่ยนจาก** `<select>` filter ทีละแปลง → **แสดงทุก Plot พร้อมกัน** เป็น accordion
- แต่ละ Plot พับไว้ (default) — คลิกหัวข้อเพื่อกาง รายละเอียดการฉีดพ่น
- หัวข้อแต่ละแปลงแสดง: ลูกศร ▶ · ชื่อ Plot · วันปลูก · จำนวน days
- ปุ่ม **Expand All / Collapse All**
- label ภาษาอังกฤษทั้งหมด

### B. Dropdown ไม่ปิดเองเมื่อ cloudSync() re-render ✅ (commit 28e6c31)
- **สาเหตุ:** ทุก 20 วิ `cloudSync()` → `renderAll()` → re-render Report → toggle รีเซ็ต
- **แก้:** เพิ่ม `rptPlotOpen` state เก็บสถานะกาง/ปิดทั้ง 3 ชั้น (Plot / Total Chemicals / รายวัน)
- ใช้ `toggleRptPlot()` (ชั้นนอก) และ `toggleRptItem()` (ชั้นใน)
- `rptExpandAll(open)` เปลี่ยนทุก Plot พร้อมกัน

### C. Crop Type ใน MX Form ✅ (commit fa86679)
- เพิ่ม **optional dropdown "Crop Type"**: Corn / Cassava / Soy Bean / Mung Bean
- ไม่เลือก = default **Corn** (ข้อมูลเก่าทั้งหมดก็ default Corn)
- บันทึกใน field `cropType` ของ MX record
- `populateMXForm()` + form reset รองรับแล้ว
- `CROP_EMOJI = { Corn:'🌽', Cassava:'🌿', SoyBean:'🫘', MungBean:'🟢' }`

### D. Production Season ✅ (commit fa86679)
- **Settings Page** เพิ่ม card "🌾 Production Season" แสดง current season
- ปุ่ม **Change Season** ต้อง PIN **9764** ก่อนเปลี่ยน
- ลำดับ season: `Rain Season / 26` → `Dry Season / 26` → `Rain Season / 27` → `Dry Season / 27` ...
- Current season เก็บใน `localStorage` key `mf_current_season`
- record ใหม่ทุกตัวติด `season: currentSeason` อัตโนมัติ
- ข้อมูลเก่าทั้งหมด default = **Rain Season / 26**

### E. Report By Plot — Season Filter + Crop Badge ✅ (commit fa86679)
- เพิ่ม **season filter dropdown** "🌾 All Seasons" / รายการ season ที่มีข้อมูล
- หัวข้อ Plot แสดง emoji ตาม crop type แทน 📍 เดิม
- Stage badge:
  - **Corn** → 🌽 V6 · D67 (ใช้ STAGE_TABLE เดิม)
  - **Corn ไม่มี stage** → 🌽 D{days}
  - **Cassava / Soy Bean / Mung Bean** → emoji + D{days} (ไม่มี VE/V1 stage)

### F. GAS Code_full.gs ✅ (commit fa86679)
- SCHEMA MX-01 เพิ่ม column: `CropType`, `Season`
- `getFieldValue()` map `cropType`, `season`
- `sheetToObjects()` ส่งกลับ column ใหม่อัตโนมัติ (header-based)
- Client cloudRead MX map: `r.cropType = r.cropType||r.CropType||''` / `r.season = r.season||r.Season||'Rain Season / 26'`

---

## 4. SCHEMA MX-01 ปัจจุบัน (14 columns)
```
ID · Date · Time · Mixer · Plot · Sprayer ·
WaterPerTank · TotalWater · SprayType · CropType · Season · Note · CreatedAt · UpdatedAt
```
+ chemical columns เพิ่มอัตโนมัติ (Atrazine, Glyphosate ฯลฯ)

---

## 5. โครงสร้าง STOCK_INIT (11 คอลัมน์)
`A Chemical · B Unit · C SnapQty · D SnapDate · E CR_Issued(auto) · F CalcQty(auto) · G PhysCount · H Variance(=G-F) · I CountDate · J Rate / Ha · K Remain (Ha)=SnapQty÷Rate`
- แก้ยอดสต๊อก = แก้ Sheet (อย่ารัน `seedStockInit()` ซ้ำ — จะลบข้อมูล + สร้างแค่ 9 คอลัมน์)

---

## 6. State Variables สำคัญ
| Variable | Key | Default |
|---|---|---|
| `currentSeason` | `mf_current_season` | `Rain Season / 26` |
| `rptPlotOpen` | (memory only) | `{}` |
| `rptSeasonFilter` | (memory only) | `'all'` |
| `rptView` | (memory only) | `'plot'` |
| `ADMIN_PIN` | hardcoded | `9764` |

---

## 7. Crop Types ที่รองรับ
| Crop | Emoji | Stage |
|------|-------|-------|
| Corn | 🌽 | VE / V1-V15 / R1-R6 |
| Cassava | 🌿 | D{days} เท่านั้น |
| Soy Bean | 🫘 | D{days} เท่านั้น |
| Mung Bean | 🟢 | D{days} เท่านั้น |

---

## 8. งานที่ยังค้างอยู่ / ต้องทำต่อ
- **Deploy GAS** — `Code_full.gs` ยังไม่ได้ deploy ครั้งนี้ (เพิ่ม CropType/Season columns) → ต้อง Edit deployment เดิม → New version เพื่อให้ Sheet รับ column ใหม่

---

## 9. App theme
- Single **light-mint-glass** (`--bg:#d4edd8`, การ์ด glass blur, badge พาสเทล)
- ไม่มี theme switcher (Dark Glass เก่าถูก revert)
- หน้า Report ใช้ `#pg-report.on{zoom:1.5}`
- Bottom nav ไอคอน 45px / label 20px / `body padding-bottom:122px`

---

## 10. หมายเหตุเทคนิคสำคัญ
- timestamp ต้องเป็น ISO UTC เสมอ (กัน bounce)
- MX-01 chem columns = ชื่อเคมีล้วน (ไม่มี suffix หน่วย); DATA AN มี `(Kg)/(L)` — `buildChemMap` reconstruct
- `sanitizeAllChems` กรอง `0 < v < 2000`
- GAS รันมือ: `backfillUpdatedAt()`, `seedStockInit()`, `fixMXfromDataAN()`, `updateMXStages()`, `updateStockInitCalc()`
- Season เปลี่ยนได้เฉพาะใน Settings + PIN 9764

---

## 11. คำสั่ง git + validate + deploy
```bash
cd "C:\Users\Admin\Jirayu"
git add index.html sw.js Code_full.gs
git commit -m "..."   # ลงท้าย Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
git push origin main
```
> แก้ index.html → bump **APP_VERSION** + **cache version ใน sw.js** (ตอนนี้ v34 → ครั้งหน้า v35)
> แก้ Code_full.gs → ไม่ต้อง bump แต่ต้อง **deploy GAS** (Edit deployment → New version)

### Validate ก่อน commit
```bash
node --check sw.js && echo "SW OK"
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let big=m.map(s=>s.replace(/<\/?script>/g,'')).join('\n;\n');try{new Function(big);console.log('JS OK')}catch(e){console.log('ERR '+e.message)}"
```

---

_อัปเดต 2026-06-23 · APP v12.06.23a / SW v34 · commit `fa86679` · Accordion Report + Crop Type + Season_
