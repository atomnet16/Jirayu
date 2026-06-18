import type { MLServicePort, MLPredictPayload, MLPredictResult } from "../ports/ml-service.port";

// Phase 1: ML service ยังไม่พร้อม — return empty เสมอ
// Core Backend compile และทำงานได้ปกติโดยไม่ต้องรอ ML service
export class NoopMLAdapter implements MLServicePort {
  async predict(_payload: MLPredictPayload): Promise<MLPredictResult> {
    return { predictions: [], latency_ms: 0 };
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}
