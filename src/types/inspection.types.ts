// Types กลางของระบบ — ใช้ร่วมกันทุก service

// ─── Input ────────────────────────────────────────────────────────────────────

export interface WeatherData {
  temperature_c: number;         // อุณหภูมิ °C
  humidity_pct: number;          // ความชื้น %
  precipitation_mm: number;      // ปริมาณฝน mm (1 ชม.ล่าสุด)
  wind_speed_kmh: number;        // ความเร็วลม km/h
  uv_index: number;              // UV Index 0–11+
  weather_description: string;   // เช่น "ท้องฟ้าแจ่มใส", "มีเมฆมาก", "ฝนตก"
}

export interface LocationData {
  display_name: string;          // ชื่อเต็ม เช่น "Kampong Speu, Cambodia"
  village?: string;              // หมู่บ้าน
  district?: string;             // อำเภอ/ตำบล
  province?: string;             // จังหวัด
  country?: string;              // ประเทศ
}

export interface InspectionInput {
  images: Buffer[];              // ภาพพืชที่จะวิเคราะห์
  plotId: string;                // รหัสแปลง
  plotName?: string;             // ชื่อแปลง
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  timestamp: string;             // ISO 8601
  inspectorName: string;
  notes?: string;
  weather: WeatherData;
  location: LocationData;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type ProblemCategory = "disease" | "pest" | "weather" | "nutrient" | "chemical";

export interface Reference {
  citation: string;   // "FAO (2021). Title. Publisher."
  refId?: string;     // "fao-plant-health-2021"
}

export interface Diagnosis {
  category: ProblemCategory;
  nameTh: string;                // ชื่อภาษาไทย
  nameEn: string;                // English name
  scientificName?: string;       // ชื่อวิทยาศาสตร์
  severity: 1 | 2 | 3 | 4 | 5;  // ระดับความรุนแรง
  confidence: number;            // ความมั่นใจ 0–100
  observedSymptoms: string[];    // อาการที่มองเห็นในรูป
  reasoning: string;             // เหตุผลการวินิจฉัย
  description: string;           // คำอธิบาย
  recommendation: string;        // คำแนะนำแก้ไข
  references: Reference[];       // แหล่งอ้างอิง (อย่างน้อย 1)
}

export interface CategorySummary {
  disease: boolean;
  pest: boolean;
  weather: boolean;
  nutrient: boolean;
  chemical: boolean;
}

export interface DiagnosisResult {
  primaryObservations: string[];   // สิ่งที่เห็นในรูปก่อนวินิจฉัย
  diagnoses: Diagnosis[];          // ผลวินิจฉัยแต่ละปัญหา
  categorySummary: CategorySummary; // สรุป 5 หมวด ว่าพบหรือไม่
  overallSeverity: 0 | 1 | 2 | 3 | 4 | 5;
  summary: string;                 // สรุปภาพรวม + คำแนะนำเร่งด่วน
  weatherInfluence: string;        // AI อธิบายว่าสภาพอากาศส่งผลต่ออาการอย่างไร
}

// ─── Full inspection record (ใช้สร้าง .md และบันทึก Sheets) ──────────────────

export interface InspectionRecord {
  input: InspectionInput;
  result: DiagnosisResult;
  createdAt: string;             // timestamp ที่ประมวลผลเสร็จ
}
