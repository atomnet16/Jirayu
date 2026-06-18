import { z } from "zod";

export const ProblemTypeSchema = z.enum([
  "disease",
  "pest",
  "weather",
  "nutrient",
  "chemical",
]);

// แหล่งอ้างอิงแบบ structured (ต้องมีทุก diagnosis)
export const ReferenceSchema = z.object({
  citation: z.string().min(1),     // เช่น "FAO (2021). Title. Publisher."
  ref_id: z.string().optional(),   // เช่น "fao-plant-health-2021"
});

export const DiagnosisSchema = z.object({
  type: ProblemTypeSchema,
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  scientific_name: z.string().optional(),
  severity: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(100),

  // อาการที่สังเกตเห็นในรูป (เพิ่มจาก v1)
  observed_symptoms: z.array(z.string()),

  // เหตุผลที่วินิจฉัยเป็นหมวดนี้ (ไม่ใช่หมวดอื่น)
  reasoning: z.string().min(1),

  description: z.string().min(1),
  recommendation: z.string().min(1),

  // บังคับมีอย่างน้อย 1 อ้างอิง
  references: z.array(ReferenceSchema).min(1),
});

// สรุป 5 หมวด ว่าตรวจพบหรือไม่
export const CategorySummarySchema = z.object({
  disease: z.boolean(),
  pest: z.boolean(),
  weather: z.boolean(),
  nutrient: z.boolean(),
  chemical: z.boolean(),
});

export const InspectResultSchema = z.object({
  diagnoses: z.array(DiagnosisSchema),
  category_summary: CategorySummarySchema,
  overall_severity: z.number().int().min(0).max(5),
  summary: z.string().min(1),

  // อาการหลักที่ AI สังเกตก่อนวินิจฉัย
  primary_observations: z.array(z.string()),
});

export const InspectRequestSchema = z.object({
  plot_id: z.string().min(1).max(100),
  plot_name: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // reject ถ้า GPS accuracy แย่กว่า 500 เมตร (ค่าผิดปกติ เช่น ไม่มีสัญญาณ)
  gps_accuracy_m: z.number().positive().max(500, {
    message: "GPS accuracy > 500m — ข้อมูลพิกัดไม่น่าเชื่อถือ กรุณาลองใหม่",
  }).optional(),
  timestamp: z.string().datetime({ offset: true }),
  inspector_name: z.string().min(1).max(100),
  notes: z.string().max(1000).optional(),
});

export type Reference = z.infer<typeof ReferenceSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type InspectResult = z.infer<typeof InspectResultSchema>;
export type InspectRequest = z.infer<typeof InspectRequestSchema>;
export type CategorySummary = z.infer<typeof CategorySummarySchema>;
