# Sprayer App (Chemical Control PWA) — สรุปฉบับสมบูรณ์ 2026-06-21

> ไฟล์นี้ใช้เริ่ม Session ใหม่ — attach ตอนเปิดแชทใหม่
> เวอร์ชันปัจจุบัน: **APP v12.06.21f / SW v30** · commit ล่าสุด `0483423`

---

## 1. ภาพรวมโปรเจกต์

| รายการ | ค่า |
|--------|-----|
| ชื่อ | Chemical Control PWA (Sprayer App) — Mega Farm Cambodia |
| ไฟล์หลัก | `C:\Users\Admin\Jirayu\index.html` (single-file PWA) |
| Service Worker | `C:\Users\Admin\Jirayu\sw.js` (**chemcontrol-v30**) |
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

## 3. งานที่ทำใน Session นี้ (2026-06-21)

### A. แก้ Data Bounce รอบสุดท้าย ✅ (commit 4b98cc1)
- **สาเหตุ:** timestamp format ปนกัน — client เขียน ISO UTC แต่ `backfillUpdatedAt()` เก่าเขียน local time ไม่มี Z + Sheets แปลงเป็น Date object → `appendMany` เทียบด้วย **string** ทำให้ค่าเก่าชนะค่าใหม่
- **แก้:** เพิ่ม `tsMs()` แปลงทุก timestamp → epoch ms, `appendMany` เทียบด้วย epoch, `backfillUpdatedAt()` เขียน ISO UTC ล้วน
- **ยืนยันแล้วว่าหาย** (เครื่องอื่น refresh ไม่เด้ง)

### B. Service Worker network-first ✅ (commit cd9a952)
- `index.html`/navigation = **network-first** → เข้าแอปตอนมีเน็ตได้เวอร์ชันล่าสุดเสมอ ไม่ต้องกด Update App; offline ใช้ cache
- เครื่องอื่นแค่ refresh ก็ได้ตัวใหม่ (ครั้งแรก transition ต้อง refresh 1–2 ครั้งเพื่อรับ SW ใหม่)

### C. Stock — คอลัมน์ Remain (Ha) ✅ (commit c2f9189)
- STOCK_INIT sheet เพิ่ม **J Rate / Ha** + **K Remain (Ha)** (= SnapQty ÷ Rate/Ha, สูตรในชีต)
- GAS `getStockInit()` อ่าน header-based ส่ง `rate`+`remainHa`; แอปแสดงเป็นคอลัมน์ที่ 6 (สี teal) ในตาราง Warehouse — ดึงตรงจากชีต ไม่คำนวณซ้ำ

### D. Stock — ค่าติดลบแสดง 0 ✅ (commit c2f9189)
- ค่าคงเหลือติดลบ → แสดง `Math.max(0, …)` ทั้ง On Truck + Warehouse + ฟอร์ม CR; **คงสี/สถานะ ⛔🔴 ตามค่าจริง** (ยังเตือนว่าเกิน/หมด)

### E. Stock — ซ่อนคอลัมน์ ✅ (commit c2f9189)
- Warehouse: ซ่อน **−CR issued** + **+RT return** (เหลือ Chemical · Initial+ST · Remaining · Remain (Ha))
- On Truck: ซ่อน **Issued · Used · %** (เหลือ Chemical · Remaining)
- ซ่อนแค่การแสดงผล — การคำนวณ remain + ข้อมูลในชีตครบเหมือนเดิม

### F. หน้า Home ดีไซน์ใหม่ ✅ (commit 0f00b94)
- การ์ด FORMS 5 อัน ใช้ **ไอคอน 3D PNG จริง** (`icons/card-*.png`) แทน emoji — grid **2 คอลัมน์**, RT จัดกลาง (`.fcard.ctr`)
- Bottom nav ใช้ **ไอคอน 3D จริง** (`icons/nav-*.png`) แทน emoji
- **เอา Reports banner ออกจาก Home** (ยังเข้าผ่าน nav ได้)

### G. ขยายขนาด nav + Report ✅ (commit 0483423)
- Bottom nav ใหญ่ขึ้น 1.5 เท่า (ไอคอน 45px, label 20px, `body padding-bottom:122px`)
- หน้า Report ขยาย 1.5 เท่าทั้งหน้า ด้วย `#pg-report.on{zoom:1.5}`

---

## 4. โครงสร้าง STOCK_INIT (11 คอลัมน์)
`A Chemical · B Unit · C SnapQty · D SnapDate · E CR_Issued(auto) · F CalcQty(auto) · G PhysCount · H Variance(=G-F) · I CountDate · J Rate / Ha · K Remain (Ha)=SnapQty÷Rate`
- ผู้ปฏิบัติกรอก: C, D, G, J | ระบบคำนวณ: E, F (GAS), H, K (สูตรชีต)
- แก้ยอดสต๊อก = แก้ Sheet (อย่ารัน `seedStockInit()` ซ้ำ — จะลบข้อมูล + สร้างแค่ 9 คอลัมน์)

---

## 5. Icon Pipeline (ในเครื่อง — ไม่ push ขึ้น repo ยกเว้น output)
- ต้นฉบับ 3D: `icons/raw/*.png` (nav) + `icons/{CR,MX,SP,ST,RT}-01.png` (การ์ด)
- สคริปต์ (Python + Pillow + numpy):
  - `icons/make_icons.py` — ตัดพื้น nav (ลบแผ่นสวิตช์ครีม, per-image params) → `nav-*.png`
  - `icons/export_cards.py` — ตัดพื้นขาวการ์ด → `card-*.png`
  - `icons/preview_home.py` — render mockup `_preview_home.png`
- **Output ที่แอปใช้ (push แล้ว):** `icons/card-{cr,mx,sp,st,rt}.png` + `icons/nav-{home,stock,reports,history,settings}.png`
- regenerate: `python make_icons.py` / `python export_cards.py`

---

## 6. หมายเหตุเทคนิคสำคัญ
- **App theme:** single **light-mint-glass** (`--bg:#d4edd8`, การ์ด glass blur, badge พาสเทล) — ไม่มี theme switcher (Dark Glass เก่าถูก revert)
- timestamp ต้องเป็น ISO UTC เสมอ (กัน bounce)
- MX-01 chem columns = ชื่อเคมีล้วน (ไม่มี suffix หน่วย); DATA AN มี `(Kg)/(L)` — `buildChemMap` reconstruct
- `sanitizeAllChems` กรอง `0 < v < 2000`
- GAS รันมือ: `backfillUpdatedAt()`, `seedStockInit()`, `fixMXfromDataAN()`, `updateMXStages()`, `updateStockInitCalc()`
- หน้า Report ใช้ `zoom` (รองรับ Chrome/Safari มือถือ; Firefox เก่าไม่ zoom แต่ไม่พัง)

---

## 7. คำสั่ง git + validate + deploy
```bash
cd "C:\Users\Admin\Jirayu"
git add index.html sw.js Code_full.gs icons/card-*.png icons/nav-*.png
git commit -m "..."   # ลงท้าย Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
git push origin main
```
> แก้ index.html → bump **APP_VERSION** + **cache version ใน sw.js** (ตอนนี้ v30 → ครั้งหน้า v31)
> แก้ Code_full.gs → ไม่ต้อง bump แต่ต้อง **deploy GAS** (Edit deployment → New version)

### Validate ก่อน commit
```bash
node --check sw.js && echo "SW OK"
node --check --input-type=commonjs - < Code_full.gs && echo "GAS OK"
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let big=m.map(s=>s.replace(/<\/?script>/g,'')).join('\n;\n');try{new Function(big);console.log('JS OK')}catch(e){console.log('ERR '+e.message)}"
```

---

_อัปเดต 2026-06-21 · APP v12.06.21f / SW v30 · commit `0483423` · Home redesign + Stock Remain(Ha) + bounce fixed_
