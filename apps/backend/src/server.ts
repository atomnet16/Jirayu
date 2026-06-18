import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { inspectRouter } from "./modules/inspect/inspect.router";
import { startDriveUploadWorker } from "./workers/drive-upload.worker";
import { ensureSheetHeaders } from "./modules/sync/sheets.service";

const app = express();

// --- Security Middleware ---
app.use(helmet());
app.use(cors({ origin: env.NODE_ENV === "production" ? "https://fieldinspect.megafarm.com" : true }));
app.use(express.json({ limit: "1mb" }));

// Rate limit: 20 req/min per IP
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: "Too many requests, please try again later" },
  })
);

// --- Routes ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/v1/inspect", inspectRouter);

// --- Start ---
async function bootstrap() {
  // ตรวจสอบ Sheet headers ตอน startup
  try {
    await ensureSheetHeaders();
    console.log("[Sheets] Headers verified");
  } catch (err) {
    console.warn("[Sheets] Could not verify headers:", (err as Error).message);
  }

  // เริ่ม BullMQ Worker
  startDriveUploadWorker();
  console.log("[Worker] Drive upload worker started");

  app.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
