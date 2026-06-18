import { google } from "googleapis";
import { env } from "../../lib/env";
import { Readable } from "stream";

// โครงสร้างโฟลเดอร์ใน Google Drive:
//
// Field-Inspection-App/
//   └── 2026/
//         └── 06 — มิถุนายน/
//               └── แปลง A12 (PLOT-A12)/    ← ใช้ชื่อแปลง + ID
//                     ├── 20260618_093200_01.jpg
//                     ├── 20260618_093200_02.jpg
//                     └── 20260618_093200_PLOT-A12_report.md

const DRIVE_ROOT = "Field-Inspection-App";

const THAI_MONTHS: Record<number, string> = {
  1: "01 — มกราคม",  2: "02 — กุมภาพันธ์", 3: "03 — มีนาคม",
  4: "04 — เมษายน",  5: "05 — พฤษภาคม",   6: "06 — มิถุนายน",
  7: "07 — กรกฎาคม", 8: "08 — สิงหาคม",   9: "09 — กันยายน",
  10: "10 — ตุลาคม", 11: "11 — พฤศจิกายน", 12: "12 — ธันวาคม",
};

// parse ครั้งเดียวตอน module load — ไม่ parse ซ้ำทุก request
const SERVICE_ACCOUNT_KEY = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

const driveAuth = new google.auth.GoogleAuth({
  credentials: SERVICE_ACCOUNT_KEY,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth: driveAuth });

// ─── Folder Helpers ───────────────────────────────────────────────────────────

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  // escape ชื่อโฟลเดอร์สำหรับ Drive query
  const escapedName = name.replace(/'/g, "\\'");

  const q = [
    `name = '${escapedName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : "",
  ]
    .filter(Boolean)
    .join(" and ");

  const res = await drive.files.list({ q, fields: "files(id, name)", pageSize: 1 });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  return created.data.id!;
}

// สร้างโครงสร้าง: Root / ปี / เดือน / ชื่อแปลง (plot_id)
export async function ensurePlotFolder(
  plotId: string,
  plotName: string | undefined,
  timestamp: string
): Promise<{ folderId: string; folderPath: string }> {
  const date = new Date(timestamp);
  const year = date.getFullYear().toString();
  const monthNum = date.getMonth() + 1;
  const monthLabel = THAI_MONTHS[monthNum]!;

  // ชื่อโฟลเดอร์แปลง: "แปลง A12 (PLOT-A12)" หรือ "PLOT-A12" ถ้าไม่มีชื่อ
  const plotFolderName = plotName
    ? `${plotName} (${plotId})`
    : plotId;

  const rootId   = await findOrCreateFolder(DRIVE_ROOT);
  const yearId   = await findOrCreateFolder(year, rootId);
  const monthId  = await findOrCreateFolder(monthLabel, yearId);
  const plotId_  = await findOrCreateFolder(plotFolderName, monthId);

  const folderPath = `${DRIVE_ROOT}/${year}/${monthLabel}/${plotFolderName}`;

  return { folderId: plotId_, folderPath };
}

// ─── Upload Helpers ───────────────────────────────────────────────────────────

async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  content: Buffer | string
): Promise<{ fileId: string; webViewLink: string }> {
  const body = typeof content === "string"
    ? Readable.from(Buffer.from(content, "utf-8"))
    : Readable.from(content);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: { mimeType, body },
    fields: "id, webViewLink",
  });

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink!,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UploadedImage {
  fileName: string;
  fileId: string;
  webViewLink: string;
}

export interface UploadedReport {
  fileName: string;
  fileId: string;
  webViewLink: string;
  folderPath: string;
}

export interface DriveUploadBundle {
  images: UploadedImage[];
  report: UploadedReport;
  folderWebViewLink: string;
}

// อัปโหลดรูปภาพทั้งหมดลงโฟลเดอร์แปลง
export async function uploadImages(
  imageBuffers: Buffer[],
  folderId: string,
  timestamp: string
): Promise<UploadedImage[]> {
  // dateStr: 20260618_093200 (รวมวินาทีเพื่อป้องกันชื่อชนกัน)
  const digits = timestamp.replace(/[^0-9]/g, ""); // 20260618093200...
  const dateStr = `${digits.slice(0, 8)}_${digits.slice(8, 14)}`; // 20260618_093200

  // parallel upload ทุกรูปพร้อมกัน
  return Promise.all(
    imageBuffers.map(async (buf, i) => {
      const fileName = `${dateStr}_${String(i + 1).padStart(2, "0")}.jpg`;
      const { fileId, webViewLink } = await uploadFile(folderId, fileName, "image/jpeg", buf);
      return { fileName, fileId, webViewLink };
    })
  );
}

// อัปโหลดไฟล์ .md สรุปเคส
export async function uploadReportMd(
  markdownContent: string,
  fileName: string,
  folderId: string,
  folderPath: string
): Promise<UploadedReport> {
  const { fileId, webViewLink } = await uploadFile(
    folderId,
    fileName,
    "text/markdown",
    markdownContent
  );

  return { fileName, fileId, webViewLink, folderPath };
}

// ดึง webViewLink ของโฟลเดอร์ (สำหรับแนบใน Sheet)
export async function getFolderWebViewLink(folderId: string): Promise<string> {
  const res = await drive.files.get({
    fileId: folderId,
    fields: "webViewLink",
  });
  return res.data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`;
}

// ─── Master Upload Function ───────────────────────────────────────────────────
// เรียกครั้งเดียว — สร้างโฟลเดอร์ + upload รูป + upload .md ครบจบ

export async function uploadInspectionBundle(
  imageBuffers: Buffer[],
  reportMarkdown: string,
  reportFileName: string,
  plotId: string,
  plotName: string | undefined,
  timestamp: string
): Promise<DriveUploadBundle> {
  // 1. สร้าง/หาโฟลเดอร์แปลง
  const { folderId, folderPath } = await ensurePlotFolder(plotId, plotName, timestamp);

  // 2. อัปโหลดรูปภาพ (parallel)
  const images = await uploadImages(imageBuffers, folderId, timestamp);

  // 3. อัปโหลดไฟล์ .md สรุป
  const report = await uploadReportMd(reportMarkdown, reportFileName, folderId, folderPath);

  // 4. ดึง link โฟลเดอร์
  const folderWebViewLink = await getFolderWebViewLink(folderId);

  return { images, report, folderWebViewLink };
}
