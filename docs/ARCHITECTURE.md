# ARCHITECTURE — Field Inspection App
### Mega Farm Cambodia

**เวอร์ชัน:** 1.0  
**วันที่:** 2026-06-18  
**หลักการ:** TypeScript ทั้งระบบ · Free APIs 100%

---

## 1. ภาพรวมระบบ

```
┌─────────────────────────────────────────────────────────┐
│                    INPUT                                 │
│         รูปภาพ + พิกัด GPS + เวลา + ชื่อผู้ตรวจ        │
└──────────────────────────┬──────────────────────────────┘
                           │
          ┌────────────────▼────────────────┐
          │         src/index.ts            │
          │      Orchestrator (TypeScript)  │
          └──┬──────────┬──────────┬────────┘
             │          │          │
    ┌────────▼───┐  ┌───▼────┐  ┌─▼──────────────┐
    │ Open-Meteo │  │Nominat.│  │  Gemini AI      │
    │  สภาพอากาศ │  │ สถานที่│  │  วินิจฉัยพืช   │
    │   (ฟรี)    │  │ (ฟรี) │  │  (ฟรี 1500/วัน)│
    └────────────┘  └────────┘  └─────────────────┘
                           │
          ┌────────────────▼────────────────┐
          │        Google Drive API         │
          │  อัปโหลดรูป + .md + Sheets row  │
          │         (ฟรี)                   │
          └─────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | เทคโนโลยี | เหตุผล |
|-------|-----------|--------|
| ภาษา | **TypeScript 5** (strict) | type-safe ทั้งระบบ |
| Runtime | **Node.js 20 LTS** | stable, ecosystem ดี |
| Dev runner | **tsx** | รัน `.ts` ได้ตรงไม่ต้อง compile |
| HTTP client | **axios** | ดึงข้อมูล Open-Meteo + Nominatim |
| AI SDK | **@google/generative-ai** | Gemini Vision ฟรี |
| Google APIs | **googleapis** | Drive + Sheets |
| Config | **dotenv** | จัดการ environment variables |

---

## 3. Free API ทั้งหมด

### 3.1 Google Gemini API — AI วินิจฉัยพืช
**SDK:** `@google/generative-ai`  
**Model:** `gemini-1.5-flash`

| รายละเอียด | ค่า |
|-----------|-----|
| Free Tier | 1,500 req/วัน, 15 req/นาที |
| Input | ภาพ (base64) + text context |
| Output | JSON — diagnosis 5 หมวด + อ้างอิง |
| สมัคร | aistudio.google.com/app/apikey |

```typescript
// src/services/gemini.service.ts
const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
const result = await model.generateContent([systemPrompt, ...imageParts, contextText]);
```

---

### 3.2 Open-Meteo API — สภาพอากาศจากพิกัด GPS
**Library:** `axios`  
**ไม่ต้องใช้ API Key**

| รายละเอียด | ค่า |
|-----------|-----|
| Free Tier | ไม่จำกัด (fair use) |
| Input | latitude, longitude, timezone |
| Output | อุณหภูมิ, ความชื้น, ฝน, ลม, UV |
| Endpoint | `https://api.open-meteo.com/v1/forecast` |

```typescript
// src/services/weather.service.ts
const url = "https://api.open-meteo.com/v1/forecast";
const params = {
  latitude: 11.5564,
  longitude: 104.9282,
  current: [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "uv_index",
    "weather_code",
  ],
  timezone: "Asia/Phnom_Penh",
};
const { data } = await axios.get(url, { params });
```

ตัวอย่าง Response:
```json
{
  "current": {
    "temperature_2m": 34.2,
    "relative_humidity_2m": 78,
    "precipitation": 0.0,
    "wind_speed_10m": 12.4,
    "uv_index": 8.5,
    "weather_code": 1
  }
}
```

---

### 3.3 OpenStreetMap Nominatim — แปลงพิกัดเป็นสถานที่
**Library:** `axios`  
**ไม่ต้องใช้ API Key**

| รายละเอียด | ค่า |
|-----------|-----|
| Free Tier | 1 req/วินาที (fair use) |
| Input | latitude, longitude |
| Output | ชื่อหมู่บ้าน / จังหวัด / ประเทศ |
| Endpoint | `https://nominatim.openstreetmap.org/reverse` |

```typescript
// src/services/location.service.ts
const { data } = await axios.get("https://nominatim.openstreetmap.org/reverse", {
  params: { lat: 11.5564, lon: 104.9282, format: "json" },
  headers: { "User-Agent": "MegaFarmFieldInspection/1.0" },
});
// data.display_name → "Kampong Speu, Cambodia"
// data.address.village / county / state
```

---

### 3.4 Google Drive API — เก็บรูปและรายงาน
**SDK:** `googleapis`  
**Auth:** Service Account

| รายละเอียด | ค่า |
|-----------|-----|
| Free Tier | 1 billion req/วัน |
| สิ่งที่อัปโหลด | ภาพ (.jpg) + รายงาน (.md) |
| โครงสร้างโฟลเดอร์ | `ฟาร์ม / ปี / เดือน / ชื่อแปลง /` |

```typescript
// src/services/drive.service.ts
await drive.files.create({
  requestBody: { name: "report.md", parents: [folderId] },
  media: { mimeType: "text/markdown", body: Readable.from(content) },
});
```

---

### 3.5 Google Sheets API — บันทึกข้อมูลตาราง
**SDK:** `googleapis`  
**Auth:** Service Account (ชุดเดียวกับ Drive)

```typescript
// src/services/sheets.service.ts
await sheets.spreadsheets.values.append({
  spreadsheetId: SHEET_ID,
  range: "Sheet1!A:P",
  valueInputOption: "USER_ENTERED",
  requestBody: { values: [[timestamp, inspector, plot, lat, lon, ...]] },
});
```

---

## 4. โครงสร้างโค้ด

```
src/
├── index.ts                   ← entry point / orchestrator
├── services/
│   ├── gemini.service.ts      ← AI วินิจฉัยภาพ (Gemini)
│   ├── weather.service.ts     ← สภาพอากาศ (Open-Meteo)
│   ├── location.service.ts    ← ชื่อสถานที่ (Nominatim)
│   ├── drive.service.ts       ← อัปโหลดไฟล์ (Drive API)
│   └── sheets.service.ts      ← บันทึกตาราง (Sheets API)
├── lib/
│   ├── env.ts                 ← โหลดและ validate .env
│   ├── report-builder.ts      ← สร้างไฟล์ .md สรุปเคส
│   └── references.db.ts       ← ฐานข้อมูลอ้างอิงทางวิชาการ
└── types/
    └── inspection.types.ts    ← TypeScript types ทั้งหมด
```

---

## 5. Flow การทำงาน

```
เจ้าหน้าที่ส่ง input (รูป + พิกัด + ชื่อแปลง)
         │
         ▼
src/index.ts รับ input และเรียก service ทั้งหมด
         │
    ┌────┴─────────────────────┐
    │ parallel (พร้อมกัน)      │
    ▼                          ▼
weather.service.ts      location.service.ts
(Open-Meteo)            (Nominatim)
อุณหภูมิ ความชื้น ฝน   ชื่อหมู่บ้าน/จังหวัด
    │                          │
    └────────────┬─────────────┘
                 ▼
         gemini.service.ts
    (รูป + อากาศ + สถานที่ → prompt)
         วินิจฉัย 5 หมวด + อ้างอิง
                 │
         report-builder.ts
         สร้างเนื้อหา .md
                 │
    ┌────────────┴────────────┐
    │ parallel                │
    ▼                         ▼
drive.service.ts        sheets.service.ts
อัปโหลดรูป + .md        append แถวข้อมูล
                 │
                 ▼
         แสดงผล + link ไฟล์
```

---

## 6. Environment Variables

```env
# AI
GEMINI_API_KEY=AIza...

# Google (ไม่ต้องใช้ API key — ใช้ Service Account)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SHEET_ID=1ABC...

# พิกัดฟาร์ม (default ถ้าไม่ส่งมา)
FARM_LATITUDE=11.5564
FARM_LONGITUDE=104.9282
```

**ไม่ต้องใช้ API key สำหรับ:**
- Open-Meteo — ไม่ต้องสมัคร ใช้ได้เลย
- Nominatim — ไม่ต้องสมัคร แค่ใส่ `User-Agent` header

---

## 7. ค่าใช้จ่าย

| บริการ | Free Tier | ค่าใช้จ่าย |
|--------|-----------|-----------|
| Gemini 1.5 Flash | 1,500 req/วัน | **ฟรี** |
| Open-Meteo | ไม่จำกัด | **ฟรี** |
| Nominatim | 1 req/วินาที | **ฟรี** |
| Google Drive API | 1B req/วัน | **ฟรี** |
| Google Sheets API | 300 req/นาที | **ฟรี** |

**รวม: ฟรี 100%**
