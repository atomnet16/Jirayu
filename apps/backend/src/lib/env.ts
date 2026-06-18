import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Claude
  ANTHROPIC_API_KEY: z.string().min(1),

  // Gemini fallback (ฟรี 1,500 req/วัน)
  GEMINI_API_KEY: z.string().min(1),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),

  // Google Service Account (JSON string)
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),

  // Google Sheets
  SHEET_ID: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // BullMQ
  REDIS_URL: z.string().url(),

  // ML Microservice (optional — ใช้ NoopAdapter ถ้าไม่กำหนด)
  ML_SERVICE_URL: z.string().url().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Environment variable validation failed:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
