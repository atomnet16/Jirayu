import { google } from "googleapis";
import { env } from "../../lib/env";
import type { InspectRequest, InspectResult } from "../inspect/schemas";
import type { UploadedImage } from "./drive.service";

// Column Map (A → P):
// A  timestamp         B  inspector_name   C  plot_id        D  plot_name
// E  latitude          F  longitude        G  gps_accuracy_m H  problem_type
// I  severity          J  diagnosis        K  recommendation L  confidence_pct
// M  image_urls        N  report_url       O  folder_url     P  notes

const SHEET_RANGE = "Sheet1!A:P";

const HEADERS = [
  "timestamp", "inspector_name", "plot_id", "plot_name",
  "latitude", "longitude", "gps_accuracy_m", "problem_type",
  "severity", "diagnosis", "recommendation", "confidence_pct",
  "image_urls", "report_url", "folder_url", "notes",
];

const SERVICE_ACCOUNT_KEY = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

const sheetsAuth = new google.auth.GoogleAuth({
  credentials: SERVICE_ACCOUNT_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

export interface SheetLinks {
  reportUrl: string;
  folderUrl: string;
}

export async function appendInspectionRow(
  req: InspectRequest,
  result: InspectResult,
  images: UploadedImage[],
  links: SheetLinks
): Promise<void> {
  const problemTypes = [...new Set(result.diagnoses.map((d) => d.type))].join(", ");
  const diagnosisNames = result.diagnoses.map((d) => d.name_th).join("; ");
  const recommendations = result.diagnoses.map((d) => d.recommendation).join("; ");
  const avgConfidence =
    result.diagnoses.length > 0
      ? (
          result.diagnoses.reduce((sum, d) => sum + d.confidence, 0) /
          result.diagnoses.length
        ).toFixed(1)
      : "0";
  const imageUrls = images.map((img) => img.webViewLink).join(", ");

  const row = [
    req.timestamp,                    // A
    req.inspector_name,               // B
    req.plot_id,                      // C
    req.plot_name ?? req.plot_id,     // D
    req.latitude,                     // E
    req.longitude,                    // F
    req.gps_accuracy_m ?? "",         // G
    problemTypes || "none",           // H
    result.overall_severity,          // I
    diagnosisNames || "ปกติ",        // J
    recommendations || "-",           // K
    avgConfidence,                    // L
    imageUrls,                        // M
    links.reportUrl,                  // N — link ไฟล์ .md
    links.folderUrl,                  // O — link โฟลเดอร์แปลง
    req.notes ?? "",                  // P
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function ensureSheetHeaders(): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_ID,
    range: "Sheet1!A1:P1",
  });

  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_ID,
      range: "Sheet1!A1:P1",
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
    console.log("[Sheets] Headers created");
  }
}
