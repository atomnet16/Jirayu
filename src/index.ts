import * as dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";
import * as path from "path";

import { getWeather }    from "./services/weatherService";
import { getLocation }   from "./services/locationService";
import { analyzeFieldInspection } from "./services/geminiService";
import { appendInspectionToSheet } from "./services/googleSheetsService";
import { buildReportMarkdown } from "./lib/reportBuilder";
import type { InspectionInput } from "./types/inspection.types";

// ─── Config ───────────────────────────────────────────────────────────────────

const LAT = Number(process.env.FARM_LATITUDE  ?? "11.5564");   // default: Phnom Penh
const LON = Number(process.env.FARM_LONGITUDE ?? "104.9282");

// ─── Load Sample Images ───────────────────────────────────────────────────────

function loadSampleImages(): Buffer[] {
  const dir = path.join(__dirname, "..", "sample-images");
  if (!fs.existsSync(dir)) {
    console.warn("⚠️  ไม่พบโฟลเดอร์ sample-images/ — จะส่งรูปว่างให้ AI");
    return [];
  }
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));
  if (files.length === 0) {
    console.warn("⚠️  ไม่มีรูปภาพใน sample-images/ — จะส่งรูปว่างให้ AI");
    return [];
  }
  console.log(`📷  พบรูปภาพ ${files.length} ไฟล์:`, files.join(", "));
  return files.map((f) => fs.readFileSync(path.join(dir, f)));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🌾  Field Inspection — Mega Farm Cambodia");
  console.log("━".repeat(50));

  // Step 1: ดึงอากาศ + สถานที่ (parallel)
  console.log("\n[1/4] ดึงข้อมูลอากาศ & ตำแหน่ง GPS...");
  const [weather, location] = await Promise.all([
    getWeather(LAT, LON),
    getLocation(LAT, LON),
  ]);
  console.log(`  🌡  ${weather.temperature_c}°C  💧 ${weather.humidity_pct}%  ☁ ${weather.weather_description}`);
  console.log(`  📍  ${location.display_name}`);

  // Step 2: สร้าง input payload
  const images = loadSampleImages();
  const input: InspectionInput = {
    images,
    plotId:        "PLOT-A01",
    plotName:      "แปลงทดสอบ A01",
    latitude:      LAT,
    longitude:     LON,
    gpsAccuracyM:  10,
    timestamp:     new Date().toISOString(),
    inspectorName: "ระบบทดสอบ",
    notes:         "ทดสอบระบบ Field Inspection อัตโนมัติ",
    weather,
    location,
  };

  // Step 3: วินิจฉัยด้วย Gemini
  console.log("\n[2/4] ส่งรูปให้ Gemini วินิจฉัย (max 60 วินาที)...");
  const result = await analyzeFieldInspection(input);
  console.log(`  ✅  วินิจฉัยเสร็จ — พบ ${result.diagnoses.length} รายการ ความรุนแรง ${result.overallSeverity}/5`);
  console.log(`  📋  สรุป: ${result.summary}`);

  // Step 4: บันทึกผลลง Google Sheet
  console.log("\n[3/4] สร้าง Markdown draft...");
  const finalReport = buildReportMarkdown(input, result);

  console.log("\n[4/4] บันทึกผลลง Google Sheet...");
  const sheetResult = await appendInspectionToSheet(input, result);
  console.log(`  📊  บันทึกแถว: ${sheetResult.updatedRange}`);
  console.log(`  🔗  ${sheetResult.sheetUrl}`);

  console.log("\n" + "━".repeat(50));
  console.log("✅  เสร็จสมบูรณ์");
  console.log(`  📊  Sheet: ${sheetResult.sheetUrl}`);
  console.log("\n━━━ REPORT PREVIEW ━━━");
  console.log(finalReport.slice(0, 300) + "…");
}

main().catch((err) => {
  console.error("\n❌  Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
