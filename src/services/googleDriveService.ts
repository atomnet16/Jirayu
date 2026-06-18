import { google } from "googleapis";
import { Readable } from "stream";
import * as dotenv from "dotenv";
import type { InspectionInput, DiagnosisResult } from "../types/inspection.types";

dotenv.config();

// ─── Auth ─────────────────────────────────────────────────────────────────────
// parse ครั้งเดียวตอน module load

const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);

const auth = new google.auth.GoogleAuth({
  credentials: SERVICE_ACCOUNT_KEY,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  name: string;
  fileId: string;
  webViewLink: string;
  mimeType: string;
}

export interface DriveUploadResult {
  folderName: string;          // ชื่อโฟลเดอร์ที่สร้าง
  folderId: string;
  folderWebViewLink: string;   // link เปิดโฟลเดอร์ใน Drive
  files: UploadedFile[];       // รูป + report.md ที่อัปโหลด
}

// ─── Folder Name ──────────────────────────────────────────────────────────────

// สร้างชื่อโฟลเดอร์: "Kampong_Speu_2026-06-18" (safe สำหรับทุก OS)
function buildFolderName(input: InspectionInput): string {
  const locationSlug = input.location.display_name
    .split(",")[0]                          // เอาแค่ส่วนแรก เช่น "Kampong Speu"
    .trim()
    .replace(/[^\w฀-๿\s]/g, "")  // เก็บ ตัวอักษร ตัวเลข ไทย เว้นวรรค
    .replace(/\s+/g, "_");                  // เว้นวรรค → _

  const dateSlug = new Date(input.timestamp)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Phnom_Penh" }); // YYYY-MM-DD

  const plotSlug = (input.plotName ?? input.plotId).replace(/\s+/g, "_");

  return `${locationSlug}_${plotSlug}_${dateSlug}`;
}

// ─── Folder Helpers ───────────────────────────────────────────────────────────

// ค้นหาหรือสร้างโฟลเดอร์ รองรับชื่อมีอักขระพิเศษ
async function findOrCreateFolder(
  name: string,
  parentId?: string
): Promise<string> {
  const escapedName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const q = [
    `name = '${escapedName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : "",
  ]
    .filter(Boolean)
    .join(" and ");

  const existing = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 1,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId && { parents: [parentId] }),
    },
    fields: "id",
  });

  return created.data.id!;
}

// ดึง webViewLink ของโฟลเดอร์
async function getFolderLink(folderId: string): Promise<string> {
  const res = await drive.files.get({
    fileId: folderId,
    fields: "webViewLink",
  });
  return (
    res.data.webViewLink ??
    `https://drive.google.com/drive/folders/${folderId}`
  );
}

// ─── File Upload ──────────────────────────────────────────────────────────────

async function uploadBuffer(
  folderId: string,
  fileName: string,
  mimeType: string,
  content: Buffer | string
): Promise<UploadedFile> {
  const body =
    typeof content === "string"
      ? Readable.from(Buffer.from(content, "utf-8"))
      : Readable.from(content);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: { mimeType, body },
    fields: "id, webViewLink, mimeType",
  });

  return {
    name: fileName,
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink!,
    mimeType: res.data.mimeType!,
  };
}

// ─── Root Folder Structure ────────────────────────────────────────────────────
// Field-Inspection-App/
//   └── 2026/
//         └── 06 — มิถุนายน/
//               └── Kampong_Speu_PLOT-A12_2026-06-18/
//                     ├── photo_01.jpg
//                     ├── photo_02.jpg
//                     └── report.md

const DRIVE_ROOT = "Field-Inspection-App";

const THAI_MONTHS: Record<number, string> = {
  1: "01 — มกราคม",   2: "02 — กุมภาพันธ์",  3: "03 — มีนาคม",
  4: "04 — เมษายน",   5: "05 — พฤษภาคม",    6: "06 — มิถุนายน",
  7: "07 — กรกฎาคม",  8: "08 — สิงหาคม",    9: "09 — กันยายน",
  10: "10 — ตุลาคม",  11: "11 — พฤศจิกายน", 12: "12 — ธันวาคม",
};

async function ensureInspectionFolder(input: InspectionInput): Promise<{
  folderId: string;
  folderName: string;
}> {
  const date = new Date(input.timestamp);
  const year = date.getFullYear().toString();
  const month = THAI_MONTHS[date.getMonth() + 1]!;
  const folderName = buildFolderName(input);

  const rootId  = await findOrCreateFolder(DRIVE_ROOT);
  const yearId  = await findOrCreateFolder(year, rootId);
  const monthId = await findOrCreateFolder(month, yearId);
  const targetId = await findOrCreateFolder(folderName, monthId);

  return { folderId: targetId, folderName };
}

// ─── Main Upload Function ─────────────────────────────────────────────────────

export async function uploadInspectionToDrive(
  input: InspectionInput,
  reportMarkdown: string,
  images: Buffer[]
): Promise<DriveUploadResult> {

  // 1. สร้างโฟลเดอร์ตามชื่อสถานที่ + วันที่
  const { folderId, folderName } = await ensureInspectionFolder(input);
  const folderWebViewLink = await getFolderLink(folderId);

  // 2. อัปโหลดรูปภาพทั้งหมด (parallel)
  const dateStr = new Date(input.timestamp)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14); // 20260618093200

  const imageUploads = await Promise.all(
    images.map((buf, i) =>
      uploadBuffer(
        folderId,
        `photo_${String(i + 1).padStart(2, "0")}_${dateStr}.jpg`,
        "image/jpeg",
        buf
      )
    )
  );

  // 3. อัปโหลดไฟล์ report.md
  const reportFileName = `report_${dateStr}.md`;
  const reportFile = await uploadBuffer(
    folderId,
    reportFileName,
    "text/markdown",
    reportMarkdown
  );

  return {
    folderName,
    folderId,
    folderWebViewLink,
    files: [...imageUploads, reportFile],
  };
}

// ─── Convenience Getters ──────────────────────────────────────────────────────

// ดึง link รูปทั้งหมดจาก result
export function getImageLinks(result: DriveUploadResult): UploadedFile[] {
  return result.files.filter((f) => f.mimeType === "image/jpeg");
}

// ดึง link report.md จาก result
export function getReportLink(result: DriveUploadResult): UploadedFile | undefined {
  return result.files.find((f) => f.mimeType === "text/markdown");
}
