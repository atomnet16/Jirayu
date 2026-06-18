import type { MLServicePort, MLPredictPayload, MLPredictResult } from "../ports/ml-service.port";

// Phase 2+: เชื่อมต่อ ML Microservice ผ่าน HTTP
// ไม่รู้จัก implementation ภายใน — ภาษาใดก็ได้ (Python, Go, ฯลฯ)
export class HttpMLAdapter implements MLServicePort {
  constructor(private readonly baseUrl: string) {}

  async predict(payload: MLPredictPayload): Promise<MLPredictResult> {
    const res = await fetch(`${this.baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`ML service error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<MLPredictResult>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
