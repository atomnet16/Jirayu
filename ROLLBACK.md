# ROLLBACK — Chem Control (Mega Farm)

วิธีกลับไปใช้ระบบเดิม (ก่อนเพิ่มฟังก์ชัน SR-01 / EV-01) ถ้าพบปัญหา

## จุดย้อนกลับที่ตรวจแล้ว

| ส่วน | เวอร์ชันเดิม (ก่อน SR) | เวอร์ชันปัจจุบัน |
|---|---|---|
| แอป (GitHub Pages) | commit `cbc6cf2` · `v14.0.ld` · cache `chemcontrol-v39` | `v14.9.lb` · cache `chemcontrol-v49` (LB-01 แก้ย้อนหลังไม่จำกัด + ยืนยัน Sheet) · รุ่นก่อนหน้า v14.8.lb = commit `dd75aaf` cache v48 (Thim เริ่มต้น + ชื่อเต็ม) · v14.6.lb cache v46 |
| Apps Script | Version 51 (Oct 8, 2026) | Version 59 (ชื่อเต็มผู้ดูแลใน LINE) · (58 = แสดง error, 57 = LB v2, 56 = ใช้ LINE ร่วมกับ Rainfall, 55 = เพิ่ม LB-01, 54 = ก่อน LB-01) |

จุดย้อนของ LB-01 รุ่นแรก (ก่อนปรับเป็นผู้ดูแล/สถานที่/กะ): แอป commit `0822e43` + Apps Script Version 56

ถ้าปัญหาอยู่ที่ฟังก์ชันคนงานอย่างเดียว ให้ย้อนแค่บางส่วน: แอปกลับ commit `513200e` (v14.4.sr) + Apps Script Version 54 — ฟังก์ชัน SR/EV ยังอยู่ครบ ชีต `LB-01`/`LB-Deleted` ไม่ถูกลบ

ไฟล์แอปเดิมในรีโปนี้: `index.pre-SR.html` และ `sw.pre-SR.js` (ตรงกับ commit cbc6cf2 ทุกไบต์ — SHA-256 B00F520CCA7AC40C811E9D902FC8F76E46AA9D9374D6A53B2D6AF48661E38D60)

## ข้อมูลไม่หาย

- ชีต MX-01, LD-01, CR-01 ไม่ถูกแก้โดยฟังก์ชันใหม่ ข้อมูลเดิมอยู่ครบไม่ว่าจะย้อนหรือไม่
- ข้อมูลคำขอ SR อยู่ในชีต `SR-01` และ `SR-Deleted` (ชีตใหม่) การย้อนระบบไม่ลบชีตเหล่านี้ แอปเดิมไม่อ่านชีตเหล่านี้
- ก่อนย้อน ถ้าต้องการเก็บคำขอ SR ให้กดปุ่ม Export Excel ในหน้า SR ก่อน

## ย้อนฝั่งแอป (GitHub)

วิธีที่ 1 (ง่ายสุด): ให้ Claude ทำ — บอกว่า "ย้อนแอปกลับ cbc6cf2" แล้วอัปโหลด `rollback-pack/restore-to-repo/index.html` และ `sw.js` ทับในรีโป

วิธีที่ 2 ด้วยตัวเอง:
1. เปิด https://github.com/atomnet16/Jirayu/upload/main
2. ลากไฟล์ `index.html` และ `sw.js` จากโฟลเดอร์ `rollback-pack/restore-to-repo/` (บนเครื่องที่เก็บไว้) ลงในหน้า แล้วกด Commit changes
   - `sw.js` ในโฟลเดอร์นั้นตั้ง cache เป็น `chemcontrol-v44` เพื่อให้มือถือโหลดไฟล์ใหม่ (ห้ามใช้ชื่อ cache ซ้ำกับเวอร์ชันที่ใช้อยู่)
   - ถ้าไม่มีโฟลเดอร์นั้น ให้ดาวน์โหลด `index.pre-SR.html` เปลี่ยนชื่อเป็น `index.html` และ `sw.pre-SR.js` เปลี่ยนชื่อเป็น `sw.js` แล้วแก้บรรทัดแรกของ `sw.js` เป็น `const CACHE = 'chemcontrol-v44';`
3. รอ 1–2 นาที แล้วบนมือถือกด Settings → Update App (Clear Cache)

## ย้อนฝั่ง Apps Script

1. เปิดโปรเจกต์ "Chemical stock on real time" → Deploy → Manage deployments
2. กดไอคอนดินสอที่ deployment ปัจจุบัน → Version: เลือก **Version 51** → Deploy (URL ไม่เปลี่ยน)
3. ถ้าตั้งเวลาเตือนประจำวันไว้ (srInstallTrigger) ให้ลบ trigger `srDailyReminders_` ที่เมนู Triggers (นาฬิกา) ด้วย
4. ถ้าย้อนเฉพาะ Apps Script แต่ไม่ย้อนแอป ฟังก์ชัน SR จะซิงก์ข้ามเครื่องไม่ได้ (ข้อมูลยังเก็บในเครื่อง) — ควรย้อนทั้งสองฝั่งพร้อมกัน

## ปิดการแจ้ง LINE อย่างเดียว (ไม่ต้องย้อนระบบ)

ใน Apps Script → Project Settings → Script properties ลบ `LINE_TOKEN` หรือ `LINE_TO` ระบบจะหยุดส่งทันที การบันทึกยังทำงานปกติ

## ย้อนบางส่วนด้วยจุดกลางทาง

| commit | เนื้อหา |
|---|---|
| `aeb5295` | SR-01 รุ่นแรก (แทน PLAN) |
| `eaf5b3d` | + แปลงพิมพ์เอง รายการสาร DATA AN LINE รุ่นแรก |
| `afa3abc` | + Flow ผูก Mixing จบแปลง EV-01 ใบเบิก |
| `513200e` | + Export xlsx |
| (ถัดไป) | + คนงานรายวัน LB-01 + LINE สรุป 18:00 |

## Trigger ที่อาจตั้งไว้ (ลบเมื่อย้อน)
- `srDailyReminders_` (08:00) จาก `srInstallTrigger`
- `lbDailyLine_` (18:00) จาก `lbInstallTrigger`
