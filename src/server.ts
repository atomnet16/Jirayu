import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import cors from "cors";
import * as path from "path";

import { getWeather }  from "./services/weatherService";
import { getLocation } from "./services/locationService";
import { analyzeFieldInspection } from "./services/geminiService";
import { appendInspectionToSheet } from "./services/googleSheetsService";
import { buildReportMarkdown } from "./lib/reportBuilder";
import type { InspectionInput } from "./types/inspection.types";

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Serve PWA static files จากโฟลเดอร์ public/
app.use(express.static(path.join(__dirname, "..", "public")));

// รับไฟล์รูปสูงสุด 5 ไฟล์ แต่ละไฟล์ไม่เกิน 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("รับเฉพาะไฟล์รูปภาพ"));
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// POST /api/inspect — รับรูป + metadata → วินิจฉัย → บันทึก Sheet
app.post("/api/inspect", upload.array("images", 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "ต้องส่งรูปภาพอย่างน้อย 1 ไฟล์" });
      return;
    }

    // รับ field จาก form-data
    const {
      plotId       = "UNKNOWN",
      plotName     = "",
      latitude,
      longitude,
      gpsAccuracyM = "",
      inspectorName = "ไม่ระบุ",
      notes        = "",
    } = req.body;

    if (!latitude || !longitude) {
      res.status(400).json({ error: "ต้องส่งพิกัด GPS (latitude, longitude)" });
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // ดึงอากาศ + สถานที่ parallel
    const [weather, location] = await Promise.all([
      getWeather(lat, lon),
      getLocation(lat, lon),
    ]);

    const input: InspectionInput = {
      images:        files.map((f) => f.buffer),
      plotId,
      plotName:      plotName || undefined,
      latitude:      lat,
      longitude:     lon,
      gpsAccuracyM:  gpsAccuracyM ? parseFloat(gpsAccuracyM) : undefined,
      timestamp:     new Date().toISOString(),
      inspectorName,
      notes:         notes || undefined,
      weather,
      location,
    };

    // วินิจฉัยด้วย Gemini
    const result = await analyzeFieldInspection(input);

    // สร้าง report + บันทึก Sheet
    buildReportMarkdown(input, result);
    const sheetResult = await appendInspectionToSheet(input, result);

    res.json({
      success: true,
      result,
      weather,
      location,
      sheetUrl: sheetResult.sheetUrl,
      timestamp: input.timestamp,
    });

  } catch (err) {
    console.error("❌ /api/inspect error:", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    res.status(500).json({ error: msg });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🌾  Field Inspection API — http://localhost:${PORT}`);
  console.log(`📊  Sheet: https://docs.google.com/spreadsheets/d/${process.env.SHEET_ID}`);
});
