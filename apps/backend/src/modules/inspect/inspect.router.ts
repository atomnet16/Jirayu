import { Router, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { analyze } from "./analyze";
import { InspectRequestSchema } from "./schemas";
import { driveUploadQueue } from "../../workers/drive-upload.worker";
import { requireAuth } from "../../lib/auth.middleware";

const router = Router();

// รับรูปใน memory — stream ไป Drive โดยตรง ไม่เก็บ disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // max 10MB, 5 ไฟล์
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WEBP images are allowed"));
    }
  },
});

// POST /inspect
// Body: multipart/form-data
//   images: File[] (max 5)
//   meta: JSON string ของ InspectRequest
router.post("/", requireAuth, upload.array("images", 5), async (req: Request, res: Response) => {
  try {
    // Parse + validate metadata
    const metaRaw = req.body.meta;
    if (!metaRaw) {
      res.status(400).json({ error: "meta field is required" });
      return;
    }

    let metaParsed: unknown;
    try {
      metaParsed = JSON.parse(metaRaw);
    } catch {
      res.status(400).json({ error: "meta must be valid JSON" });
      return;
    }
    const meta = InspectRequestSchema.parse(metaParsed);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: "At least one image is required" });
      return;
    }

    // ตรวจ magic bytes จริง (ไม่เชื่อ Content-Type จาก client)
    const { fileTypeFromBuffer } = await import("file-type");
    const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
    for (const f of files) {
      const detected = await fileTypeFromBuffer(f.buffer);
      if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
        res.status(400).json({ error: `Invalid file type: ${detected?.mime ?? "unknown"}` });
        return;
      }
    }

    // Compress ทุกรูป → max 1920px, quality 85
    const compressedBuffers = await Promise.all(
      files.map((f) =>
        sharp(f.buffer)
          .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
      )
    );

    // แปลง Buffer → base64 สำหรับส่ง AI
    const base64Images = compressedBuffers.map((b) => b.toString("base64"));

    // วิเคราะห์ด้วย AI — timeout 60 วินาที
    const result = await Promise.race([
      analyze(base64Images, meta),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI analysis timeout")), 60_000)
      ),
    ]);

    // Enqueue การอัปโหลด Drive + Sheet (background)
    const job = await driveUploadQueue.add("upload", {
      inspectId: `${meta.plot_id}_${Date.now()}`,
      req: meta,
      result,
      imageBuffers: base64Images,
    });

    const gpsWarning =
      meta.gps_accuracy_m && meta.gps_accuracy_m > 50
        ? `⚠️ GPS accuracy ${meta.gps_accuracy_m}m — พิกัดอาจคลาดเคลื่อน`
        : undefined;

    res.status(200).json({
      success: true,
      result,
      job_id: job.id,
      ...(gpsWarning && { gps_warning: gpsWarning }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.flatten() });
      return;
    }
    console.error("[inspect] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /inspect/job/:jobId — เช็คสถานะ Drive upload
router.get("/job/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await driveUploadQueue.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = state === "completed" ? await job.returnvalue : undefined;

    res.json({ job_id: job.id, state, progress, result: returnValue });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as inspectRouter };
