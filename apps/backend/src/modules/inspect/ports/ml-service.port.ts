export interface MLPredictPayload {
  images: string[]; // base64
  model_id?: string;
  threshold?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MLPrediction {
  label: string;
  confidence: number;
  bounding_box?: BoundingBox;
}

export interface MLPredictResult {
  predictions: MLPrediction[];
  latency_ms: number;
}

export interface MLServicePort {
  predict(payload: MLPredictPayload): Promise<MLPredictResult>;
  healthCheck(): Promise<boolean>;
}
