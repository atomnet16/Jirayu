# Field Inspection App — Project Summary
> Mega Farm Cambodia · สร้างเสร็จ 18 มิถุนายน 2569

---

## ระบบทำอะไร

แอปตรวจแปลงเกษตรผ่านมือถือ — ถ่ายรูปพืช → AI วินิจฉัยโรค → บันทึก Google Sheet อัตโนมัติ

---

## Stack ทั้งหมด (ฟรี 100%)

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | PWA (HTML+JS ไฟล์เดียว) |
| Backend | Node.js + TypeScript + Express |
| AI | Gemini 2.5 Flash (500 req/วัน ฟรี) |
| อากาศ | Open-Meteo API (ไม่ต้อง key) |
| GPS/แผนที่ | Nominatim / OpenStreetMap (ไม่ต้อง key) |
| บันทึกข้อมูล | Google Sheets API v4 |
| Deploy | Railway (ไม่ต้องเปิดคอม) |

---

## URL

```
https://jirayu-production.up.railway.app
```

---

## โครงสร้างไฟล์

```
src/
├── server.ts                   ← Express API (entry point)
├── index.ts                    ← CLI test runner
├── types/inspection.types.ts   ← TypeScript types กลาง
├── services/
│   ├── geminiService.ts        ← AI วินิจฉัย (Gemini 2.5 Flash)
│   ├── googleSheetsService.ts  ← บันทึกผลลง Sheet
│   ├── weatherService.ts       ← ดึงอากาศ (Open-Meteo)
│   └── locationService.ts      ← แปลง GPS → ชื่อสถานที่ (Nominatim)
└── lib/
    └── reportBuilder.ts        ← สร้าง Markdown report
public/
└── index.html                  ← PWA มือถือ (ไฟล์เดียว)
```

---

## API Endpoints

| Method | Path | หน้าที่ |
|--------|------|---------|
| GET | `/api/health` | ตรวจสอบ server |
| POST | `/api/inspect` | รับรูป + GPS → วินิจฉัย → บันทึก Sheet |

### Request (multipart/form-data)
```
images[]       รูปภาพ 1-5 ไฟล์ (JPG/PNG)
plotId         รหัสแปลง
plotName       ชื่อแปลง (optional)
inspectorName  ชื่อผู้ตรวจ
latitude       พิกัด GPS
longitude      พิกัด GPS
notes          หมายเหตุ (optional)
```

---

## การวินิจฉัย AI — 5 หมวด

| หมวด | ตัวอย่าง |
|------|---------|
| 🦠 โรคพืช | เน่าเละ, ราน้ำค้าง, ไหม้แบคทีเรีย |
| 🐛 แมลงศัตรูพืช | เพลี้ย, ไร, หนอน |
| 🌤 สภาพอากาศ | เครียดน้ำ, ความร้อน, น้ำท่วม |
| 🌿 ธาตุอาหาร | ขาด N/P/K, pH ดิน |
| ⚗️ พิษสารเคมี | ยาตกค้าง, ยาฆ่าหญ้าเกินขนาด |

---

## Google Sheet Columns (19 คอลัมน์)

วันที่/เวลา · รหัสแปลง · ชื่อแปลง · ผู้ตรวจ · สถานที่ · Lat · Lon · อุณหภูมิ · ความชื้น · ฝน · อากาศ · ความรุนแรง · หมวดที่พบ · ปัญหาหลัก · สรุปผล · รายละเอียด · ผลกระทบอากาศ · จำนวนรูป · หมายเหตุ

---

## Environment Variables ที่ต้องตั้ง

```env
GEMINI_API_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=
SHEET_ID=
SHEET_TAB=Inspections
FARM_LATITUDE=
FARM_LONGITUDE=
```

---

## ขีดจำกัดที่ควรรู้

| รายการ | ขีดจำกัด |
|--------|---------|
| Gemini free | 500 req/วัน, 10 req/นาที |
| รูปต่อครั้ง | สูงสุด 5 รูป, 10MB/รูป |
| Railway free | 500 ชม./เดือน |
| Google Sheets | 10M cells/sheet |

---

## ยังไม่ได้ทำ (Future)

- [ ] เก็บรูปภาพถาวร (Cloudinary / Drive OAuth2)
- [ ] แจ้งเตือน LINE เมื่อพบปัญหารุนแรง
- [ ] Dashboard สรุปรายสัปดาห์
- [ ] รองรับภาษาเขมร
