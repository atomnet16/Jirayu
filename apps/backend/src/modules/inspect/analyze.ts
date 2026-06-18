import { env } from "../../lib/env";
import { runInspectAgent } from "./agent";
import { analyzeWithGeminiFallback } from "./ai-client";
import { HttpMLAdapter } from "./adapters/http-ml.adapter";
import { NoopMLAdapter } from "./adapters/noop-ml.adapter";
import type { MLServicePort } from "./ports/ml-service.port";
import type { InspectRequest, InspectResult } from "./schemas";

function createMLAdapter(): MLServicePort {
  return env.ML_SERVICE_URL
    ? new HttpMLAdapter(env.ML_SERVICE_URL)
    : new NoopMLAdapter();
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("529") ||
      msg.includes("503") ||
      msg.includes("overloaded") ||
      msg.includes("rate_limit")
    );
  }
  return false;
}

export async function analyze(
  images: string[],
  req: InspectRequest
): Promise<InspectResult> {
  const mlAdapter = createMLAdapter();
  const mlReady = await mlAdapter.healthCheck();

  // Phase 2+: ML service ตรวจ class label ก่อน → Agent ใช้เป็น context เสริม
  if (mlReady) {
    const mlResult = await mlAdapter.predict({ images, threshold: 0.6 });
    const mlContext = mlResult.predictions
      .map((p) => `${p.label} (${p.confidence.toFixed(0)}%)`)
      .join(", ");

    const enrichedReq: InspectRequest = {
      ...req,
      notes: [req.notes, `ML pre-detection: ${mlContext}`].filter(Boolean).join(" | "),
    };

    try {
      return await runInspectAgent(images, enrichedReq);
    } catch (err) {
      if (isRetryable(err)) {
        console.warn("[Analyze] Claude overloaded, falling back to Gemini");
        return await analyzeWithGeminiFallback(images, enrichedReq);
      }
      throw err;
    }
  }

  // Phase 1: Claude (Agent 3-step) → Gemini fallback ถ้า Claude ล่ม/เต็ม
  try {
    return await runInspectAgent(images, req);
  } catch (err) {
    if (isRetryable(err)) {
      console.warn("[Analyze] Claude unavailable, falling back to Gemini (free)");
      return await analyzeWithGeminiFallback(images, req);
    }
    throw err;
  }
}
