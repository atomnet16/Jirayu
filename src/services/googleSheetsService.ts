import { google } from "googleapis";
import * as dotenv from "dotenv";
import type { InspectionInput, DiagnosisResult } from "../types/inspection.types";

dotenv.config();

// ─── Auth ─────────────────────────────────────────────────────────────────────
// ใช้ Service Account เดียวกับ Drive — Sheet ที่ user สร้างแล้ว Share ให้ SA
// จะ append ได้โดยไม่ติด storage quota (ไฟล์เป็นของ user)

const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);

const auth = new google.auth.GoogleAuth({
  credentials: SERVICE_ACCOUNT_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const SHEET_ID = process.env.SHEET_ID!;
const TAB_NAME = process.env.SHEET_TAB ?? "Inspections";

// ─── Header ───────────────────────────────────────────────────────────────────

const HEADER = [
  "วันที่/เวลา",
  "รหัสแปลง",
  "ชื่อแปลง",
  "ผู้ตรวจ",
  "สถานที่",
  "Latitude",
  "Longitude",
  "อุณหภูมิ(°C)",
  "ความชื้น(%)",
  "ฝน(mm)",
  "สภาพอากาศ",
  "ความรุนแรงรวม(0-5)",
  "หมวดที่พบ",
  "ปัญหาหลัก",
  "สรุปผล",
  "รายละเอียดวินิจฉัย",
  "ผลกระทบอากาศ",
  "จำนวนรูป",
  "หมายเหตุ",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_TH: Record<string, string> = {
  disease: "โรคพืช",
  pest: "แมลงศัตรูพืช",
  weather: "สภาพอากาศ",
  nutrient: "ธาตุอาหาร",
  chemical: "พิษสารเคมี",
};

// ตรวจว่ามี header แล้วหรือยัง ถ้ายังให้ใส่
async function ensureHeader(): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A1:S1`,
  });

  const hasHeader = res.data.values && res.data.values.length > 0;
  if (!hasHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

// รวมรายละเอียดวินิจฉัยทุกข้อเป็นข้อความเดียว
function formatDiagnoses(result: DiagnosisResult): string {
  if (result.diagnoses.length === 0) return "ไม่พบปัญหา";
  return result.diagnoses
    .map((d, i) =>
      `${i + 1}. [${CATEGORY_TH[d.category]}] ${d.nameTh} (${d.nameEn}) ` +
      `ความรุนแรง ${d.severity}/5, มั่นใจ ${d.confidence}% — ${d.recommendation}`
    )
    .join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export interface SheetAppendResult {
  spreadsheetId: string;
  updatedRange: string;
  sheetUrl: string;
}

export async function appendInspectionToSheet(
  input: InspectionInput,
  result: DiagnosisResult
): Promise<SheetAppendResult> {
  await ensureHeader();

  const foundCategories = Object.entries(result.categorySummary)
    .filter(([, found]) => found)
    .map(([cat]) => CATEGORY_TH[cat] ?? cat)
    .join(", ") || "ไม่พบ";

  const localTime = new Date(input.timestamp).toLocaleString("th-TH", {
    timeZone: "Asia/Phnom_Penh",
  });

  const row = [
    localTime,
    input.plotId,
    input.plotName ?? "",
    input.inspectorName,
    input.location.display_name,
    input.latitude,
    input.longitude,
    input.weather.temperature_c,
    input.weather.humidity_pct,
    input.weather.precipitation_mm,
    input.weather.weather_description,
    result.overallSeverity,
    foundCategories,
    result.diagnoses[0]?.nameTh ?? "ไม่พบปัญหา",
    result.summary,
    formatDiagnoses(result),
    result.weatherInfluence,
    input.images.length,
    input.notes ?? "",
  ];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return {
    spreadsheetId: SHEET_ID,
    updatedRange: res.data.updates?.updatedRange ?? "",
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}`,
  };
}
