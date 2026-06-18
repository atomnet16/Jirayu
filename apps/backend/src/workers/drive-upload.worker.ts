import { Worker, Queue } from "bullmq";
import { google } from "googleapis";
import { Readable } from "stream";
import { env } from "../lib/env";
import { uploadInspectionBundle, ensurePlotFolder } from "../modules/sync/drive.service";
import { appendInspectionRow } from "../modules/sync/sheets.service";
import { buildInspectionReport, buildReportFileName } from "../modules/sync/report-builder";
import type { InspectRequest, InspectResult } from "../modules/inspect/schemas";
import type { DriveUploadBundle } from "../modules/sync/drive.service";

export interface DriveUploadJobData {
  inspectId: string;
  req: InspectRequest;
  result: InspectResult;
  imageBuffers: string[]; // base64 — serializable ผ่าน Redis
}

export interface DriveUploadJobResult {
  bundle: DriveUploadBundle;
}

const connection = { url: env.REDIS_URL };

export const driveUploadQueue = new Queue<DriveUploadJobData, DriveUploadJobResult>(
  "drive-upload",
  { connection }
);

export function startDriveUploadWorker() {
  const worker = new Worker<DriveUploadJobData, DriveUploadJobResult>(
    "drive-upload",
    async (job) => {
      const { req, result, imageBuffers } = job.data;

      await job.updateProgress(10);

      // 1. แปลง base64 → Buffer
      const buffers = imageBuffers.map((b) => Buffer.from(b, "base64"));

      // 2. สร้างไฟล์ .md สรุปเคส
      //    (ทำก่อน upload เพราะ report ต้องฝัง link รูปด้วย — แต่ตอนนี้ยังไม่มี link)
      //    จะ render รายงานรอบสุดท้ายหลัง upload รูปเสร็จ (ดูขั้นตอนที่ 4)
      const reportFileName = buildReportFileName(req);

      await job.updateProgress(20);

      // 3. อัปโหลดรูป + สร้างโฟลเดอร์ + อัปโหลด .md ครบจบใน 1 function
      //    - สร้างโครงสร้าง: Root / ปี / เดือน / ชื่อแปลง (plot_id)
      //    - upload รูปทั้งหมด
      //    - สร้างและ upload .md (draft ก่อนมี image link)
      const draftReport = buildInspectionReport(req, result, []);
      const bundle = await uploadInspectionBundle(
        buffers,
        draftReport,
        reportFileName,
        req.plot_id,
        req.plot_name,
        req.timestamp
      );

      await job.updateProgress(70);

      // 4. อัปเดตเนื้อหาไฟล์ .md ด้วย files.update (ไม่ลบ-สร้างใหม่ = ไม่มี race condition)
      const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials: key,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
      const drive = google.drive({ version: "v3", auth });

      const finalReport = buildInspectionReport(req, result, bundle.images);
      const updateRes = await drive.files.update({
        fileId: bundle.report.fileId,
        media: {
          mimeType: "text/markdown",
          body: Readable.from(Buffer.from(finalReport, "utf-8")),
        },
        fields: "id, webViewLink",
      });

      bundle.report = {
        fileName: reportFileName,
        fileId: updateRes.data.id!,
        webViewLink: updateRes.data.webViewLink ?? bundle.report.webViewLink,
        folderPath: bundle.report.folderPath,
      };

      await job.updateProgress(90);

      // 5. append แถวลง Google Sheet พร้อม link รูปและ report
      await appendInspectionRow(req, result, bundle.images, {
        reportUrl: bundle.report.webViewLink,
        folderUrl: bundle.folderWebViewLink,
      });

      await job.updateProgress(100);

      console.log(`[DriveWorker] ✅ ${req.plot_id} — ${bundle.report.folderPath}`);

      return { bundle };
    },
    { connection, concurrency: 3 }
  );

  worker.on("completed", (job) => {
    console.log(`[DriveWorker] Job ${job.id} done`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[DriveWorker] Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}
