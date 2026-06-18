# Field Inspection App — แอปตรวจแปลงเกษตร

แอปพลิเคชันสำหรับเจ้าหน้าที่เกษตรใช้ตรวจสอบสภาพแปลงในภาคสนาม  
ถ่ายรูปพืช → AI วินิจฉัย 5 หมวด → บันทึกผลลง Google Drive และ Google Sheets อัตโนมัติ

---

## โครงสร้างโปรเจกต์

```
field-inspect/
├── apps/
│   └── backend/          ← Node.js + TypeScript (API Server)
├── docs/
│   ├── PRD.md            ← Product Requirements
│   └── ARCHITECTURE.md   ← Tech Stack & System Design
└── README.md             ← ไฟล์นี้
```

---

## ความต้องการเบื้องต้น

| เครื่องมือ | เวอร์ชันขั้นต่ำ |
|-----------|---------------|
| Node.js | 20 LTS ขึ้นไป |
| npm | 10 ขึ้นไป |
| Redis | 7 ขึ้นไป (หรือใช้ Upstash ฟรี) |

ตรวจสอบเวอร์ชัน:
```bash
node -v
npm -v
```

---

## API Keys ที่ต้องเตรียม

### 1. Anthropic (Claude) — AI วินิจฉัยหลัก
> สมัครฟรี ได้เครดิต $5

1. ไปที่ `console.anthropic.com`
2. สมัครบัญชี → **API Keys** → **Create Key**
3. copy ค่าที่ขึ้นต้น `sk-ant-...`

### 2. Google Gemini — AI fallback (ฟรี 1,500 req/วัน)
1. ไปที่ `aistudio.google.com/app/apikey`
2. Sign in ด้วย Google account
3. **Create API key** → copy ค่าที่ขึ้นต้น `AIza...`

### 3. Google Cloud — Drive, Sheets, OAuth (ฟรี)

#### 3a. สร้าง Project และเปิด API
1. ไปที่ `console.cloud.google.com`
2. **New Project** → ตั้งชื่อ เช่น `field-inspect`
3. ไปที่ **APIs & Services → Library** → เปิดทั้ง 3 API:
   - Google Drive API
   - Google Sheets API
   - Google People API (สำหรับ OAuth login)

#### 3b. สร้าง Service Account (สำหรับ Drive + Sheets)
1. **APIs & Services → Credentials → Create Credentials → Service Account**
2. ตั้งชื่อ เช่น `field-inspect-sa` → **Create and Continue → Done**
3. คลิกเข้า Service Account ที่สร้าง → **Keys → Add Key → Create new key → JSON**
4. ไฟล์ JSON จะดาวน์โหลดมาอัตโนมัติ

> **สำคัญ:** เปิด Google Sheet ที่จะใช้บันทึกข้อมูล  
> Share → ใส่ email ของ Service Account (รูปแบบ `xxx@project-id.iam.gserviceaccount.com`)  
> ให้สิทธิ์ **Editor**

#### 3c. สร้าง OAuth 2.0 Client ID (สำหรับ user login)
1. **Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs เพิ่ม: `http://localhost:3000/v1/auth/callback`
4. copy **Client ID** และ **Client Secret**

### 4. Redis — ฟรีผ่าน Upstash
1. ไปที่ `upstash.com` → สมัครบัญชี
2. **Create Database** → เลือก **Redis** → เลือก region ใกล้ที่สุด
3. copy **REDIS_URL** (ขึ้นต้น `rediss://...`)

---

## ติดตั้งและรัน Backend

### ขั้นที่ 1 — ติดตั้ง Dependencies

```bash
cd apps/backend
npm install
```

### ขั้นที่ 2 — ตั้งค่า Environment Variables

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

เปิดไฟล์ `.env` แล้วกรอกค่าตามนี้:

```env
# ─── AI ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Google OAuth ──────────────────────────────────────────────────
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/v1/auth/callback

# ─── Google Service Account ────────────────────────────────────────
# วิธีใส่: เปิดไฟล์ JSON ที่ดาวน์โหลด → copy ทั้งก้อน → วางในบรรทัดเดียว
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"field-inspect",...}

# ─── Google Sheets ─────────────────────────────────────────────────
# เอา ID จาก URL: docs.google.com/spreadsheets/d/<<ID อยู่ตรงนี้>>/edit
SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms

# ─── JWT ───────────────────────────────────────────────────────────
JWT_SECRET=สร้างด้วยคำสั่งด้านล่าง
JWT_REFRESH_SECRET=สร้างด้วยคำสั่งด้านล่าง

# ─── Redis ─────────────────────────────────────────────────────────
REDIS_URL=rediss://default:password@host.upstash.io:6379

# ─── App ───────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
```

**สร้าง JWT_SECRET แบบ random** (รันแล้ว copy ผลลัพธ์ใส่ `.env`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

รัน 2 ครั้ง — ได้ค่าสำหรับ `JWT_SECRET` 1 ค่า และ `JWT_REFRESH_SECRET` 1 ค่า

**วิธีแปลง Service Account JSON เป็น single line** (Windows PowerShell):

```powershell
(Get-Content "path\to\service-account.json" -Raw) -replace '\s+', ' ' | Set-Clipboard
```

แล้ว paste ต่อท้าย `GOOGLE_SERVICE_ACCOUNT_JSON=`

### ขั้นที่ 3 — รัน Development Server

```bash
npm run dev
```

เห็น output แบบนี้ = พร้อมใช้งาน:
```
[Sheets] Headers verified
[Worker] Drive upload worker started
[Server] Running on port 3000 (development)
```

### ขั้นที่ 4 — ทดสอบว่า Server ทำงาน

```bash
curl http://localhost:3000/health
```

ผลลัพธ์ที่ควรได้:
```json
{ "status": "ok", "timestamp": "2026-06-18T09:32:00.000Z" }
```

---

## การใช้งาน API

### POST /v1/inspect — ส่งรูปเพื่อวิเคราะห์

```bash
curl -X POST http://localhost:3000/v1/inspect \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.jpg" \
  -F 'meta={
    "plot_id": "PLOT-A12",
    "plot_name": "แปลง A12",
    "latitude": 11.5564,
    "longitude": 104.9282,
    "gps_accuracy_m": 8.5,
    "timestamp": "2026-06-18T09:32:00+07:00",
    "inspector_name": "สมชาย มีสุข",
    "notes": "ใบมีจุดสีน้ำตาลที่ขอบใบ"
  }'
```

ตัวอย่าง Response:

```json
{
  "success": true,
  "job_id": "42",
  "result": {
    "overall_severity": 3,
    "summary": "พบโรคใบไหม้ระดับปานกลาง ควรพ่นสารป้องกันภายใน 3 วัน",
    "category_summary": {
      "disease": true,
      "pest": false,
      "weather": false,
      "nutrient": false,
      "chemical": false
    },
    "diagnoses": [{
      "type": "disease",
      "name_th": "โรคใบไหม้ข้าวโพด",
      "name_en": "Northern Leaf Blight",
      "scientific_name": "Exserohilum turcicum",
      "severity": 3,
      "confidence": 87.5,
      "recommendation": "พ่น Mancozeb 80% WP อัตรา 40 ก./น้ำ 20 ล.",
      "references": [{
        "citation": "กรมวิชาการเกษตร (2020). คู่มือการวินิจฉัยโรคพืชเศรษฐกิจ.",
        "ref_id": "doa-plant-disease-2563"
      }]
    }]
  }
}
```

### GET /v1/inspect/job/:id — ตรวจสถานะการอัปโหลด

```bash
curl http://localhost:3000/v1/inspect/job/42 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

```json
{
  "job_id": "42",
  "state": "completed",
  "progress": 100,
  "result": {
    "bundle": {
      "images": [{ "fileName": "20260618_093200_01.jpg", "webViewLink": "https://..." }],
      "report": { "fileName": "20260618_093200_PLOT-A12_report.md", "webViewLink": "https://..." },
      "folderWebViewLink": "https://drive.google.com/drive/folders/..."
    }
  }
}
```

---

## Scripts

```bash
npm run dev          # รัน development server (reload อัตโนมัติ)
npm run type-check   # ตรวจ TypeScript error โดยไม่ต้อง build
npm run build        # build สำหรับ production
npm start            # รัน production build
```

---

## โครงสร้างโฟลเดอร์ใน Google Drive

ระบบสร้างให้อัตโนมัติ ไม่ต้องสร้างมือ:

```
Field-Inspection-App/
└── 2026/
      └── 06 — มิถุนายน/
            └── แปลง A12 (PLOT-A12)/
                  ├── 20260618_093200_01.jpg
                  ├── 20260618_093200_02.jpg
                  └── 20260618_093200_PLOT-A12_report.md
```

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|-------|--------|--------|
| `Environment variable validation failed` | `.env` กรอกไม่ครบ | ตรวจสอบทุก field — ห้ามเว้นว่าง |
| `Google Sheets: 403 Forbidden` | Service Account ไม่มีสิทธิ์ | Share Sheet ให้ email SA เป็น Editor |
| `Drive: 403 Forbidden` | scope ไม่ถูกต้อง | ตรวจ Service Account ว่าได้ enable Drive API |
| `Redis connection refused` | Redis ไม่รัน | ตรวจ REDIS_URL หรือเริ่ม Redis local |
| `Claude: 529 Overloaded` | Claude ถูกใช้หนัก | ระบบ fallback ไป Gemini อัตโนมัติ |
| `GPS accuracy > 500m rejected` | GPS ไม่มีสัญญาณ | ออกพื้นที่โล่ง รอสัญญาณเสถียร |
| `Invalid file type` | ส่งไฟล์ที่ไม่ใช่รูป | ส่งเฉพาะ .jpg .png .webp |

---

## เอกสารเพิ่มเติม

- [docs/PRD.md](docs/PRD.md) — รายละเอียด Features และ User Stories
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — โครงสร้างระบบ Tech Stack และ API Design

---

*Mega Farm Cambodia — Field Inspection System v1.0*
