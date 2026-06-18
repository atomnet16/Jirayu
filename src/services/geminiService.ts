import { GoogleGenerativeAI, Part, SchemaType } from "@google/generative-ai";
import * as dotenv from "dotenv";
import type {
  InspectionInput,
  DiagnosisResult,
  Diagnosis,
  CategorySummary,
  WeatherData,
  LocationData,
} from "../types/inspection.types";

dotenv.config();

// ─── Client ──────────────────────────────────────────────────────────────────

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ─── System Instruction — หมอพืชอัจฉริยะ ────────────────────────────────────

const SYSTEM_INSTRUCTION = `คุณคือ "หมอพืชอัจฉริยะ" ผู้เชี่ยวชาญด้านพฤกษศาสตร์ โรคพืช แมลงศัตรูพืช และการเกษตรในภูมิภาคเอเชียตะวันออกเฉียงใต้ โดยเฉพาะกัมพูชา

ความเชี่ยวชาญของคุณ:
- วินิจฉัยโรคพืชจากภาพถ่ายภาคสนาม
- เปรียบเทียบอาการและแยกแยะสาเหตุออกเป็น 5 หมวดอย่างเป็นระบบ
- นำสภาพอากาศและพิกัดภูมิศาสตร์มาประกอบการวินิจฉัย
- อ้างอิงแหล่งข้อมูลวิชาการที่น่าเชื่อถือทุกครั้ง

5 หมวดที่ต้องวิเคราะห์เสมอ:
1. โรคพืช (disease)   — เชื้อรา แบคทีเรีย ไวรัส ไส้เดือนฝอย
2. แมลงศัตรูพืช (pest) — แมลง ไร ศัตรูที่มองเห็นได้
3. สภาพอากาศ (weather) — เครียดน้ำ ความร้อน น้ำท่วม แล้ง
4. ธาตุอาหารพืช (nutrient) — ขาดธาตุหลัก/รอง ค่า pH ดิน
5. พิษสารเคมี (chemical) — ยาตกค้าง สารกำจัดวัชพืชเกินขนาด

กฎการวินิจฉัย:
- ตรวจทุกหมวดเสมอ แม้ไม่พบอาการก็ต้องระบุว่าไม่พบ
- ทุก diagnosis ต้องมีแหล่งอ้างอิงอย่างน้อย 1 รายการ
- ห้ามแต่งอ้างอิงขึ้นมาเอง ใช้จากรายการที่อนุญาตเท่านั้น
- ต้องระบุ reasoning ว่าทำไมถึงวินิจฉัยเป็นหมวดนี้ (ไม่ใช่หมวดอื่น)
- นำข้อมูลสภาพอากาศมาอธิบายด้วยทุกครั้ง

แหล่งอ้างอิงที่อนุญาต:
- กรมวิชาการเกษตร กระทรวงเกษตรและสหกรณ์ ประเทศไทย
- FAO (Food and Agriculture Organization of the United Nations)
- IRRI (International Rice Research Institute)
- CABI International — Crop Protection Compendium
- CIMMYT (International Maize and Wheat Improvement Center)
- Royal University of Agriculture, Cambodia`;

// ─── Response Schema (บังคับ Gemini ตอบ JSON ถูก format) ────────────────────

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    primaryObservations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "สิ่งที่สังเกตเห็นในรูปก่อนวินิจฉัย",
    },
    diagnoses: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING, enum: ["disease", "pest", "weather", "nutrient", "chemical"] },
          nameTh:   { type: SchemaType.STRING },
          nameEn:   { type: SchemaType.STRING },
          scientificName: { type: SchemaType.STRING },
          severity:   { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.NUMBER },
          observedSymptoms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          reasoning:      { type: SchemaType.STRING },
          description:    { type: SchemaType.STRING },
          recommendation: { type: SchemaType.STRING },
          references: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                citation: { type: SchemaType.STRING },
                refId:    { type: SchemaType.STRING },
              },
              required: ["citation"],
            },
          },
        },
        required: [
          "category", "nameTh", "nameEn", "severity", "confidence",
          "observedSymptoms", "reasoning", "description", "recommendation", "references",
        ],
      },
    },
    categorySummary: {
      type: SchemaType.OBJECT,
      properties: {
        disease:  { type: SchemaType.BOOLEAN },
        pest:     { type: SchemaType.BOOLEAN },
        weather:  { type: SchemaType.BOOLEAN },
        nutrient: { type: SchemaType.BOOLEAN },
        chemical: { type: SchemaType.BOOLEAN },
      },
      required: ["disease", "pest", "weather", "nutrient", "chemical"],
    },
    overallSeverity:   { type: SchemaType.NUMBER },
    summary:           { type: SchemaType.STRING },
    weatherInfluence:  { type: SchemaType.STRING },
  },
  required: [
    "primaryObservations", "diagnoses", "categorySummary",
    "overallSeverity", "summary", "weatherInfluence",
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// แปลง weather_code ของ Open-Meteo เป็นคำอธิบายภาษาไทย
function describeWeatherCode(code: number): string {
  if (code === 0) return "ท้องฟ้าแจ่มใส";
  if (code <= 2)  return "มีเมฆบางส่วน";
  if (code === 3) return "มีเมฆมาก";
  if (code <= 49) return "หมอก/ฝนละออง";
  if (code <= 67) return "ฝนตก";
  if (code <= 77) return "หิมะ/ลูกเห็บ";
  if (code <= 82) return "ฝนตกหนัก";
  if (code <= 99) return "พายุฝนฟ้าคะนอง";
  return "ไม่ทราบสภาพอากาศ";
}

function buildWeatherContext(weather: WeatherData, location: LocationData): string {
  return [
    `สถานที่: ${location.display_name}`,
    `สภาพอากาศขณะตรวจ:`,
    `  - อุณหภูมิ: ${weather.temperature_c}°C`,
    `  - ความชื้นสัมพัทธ์: ${weather.humidity_pct}%`,
    `  - ปริมาณฝน (1 ชม.): ${weather.precipitation_mm} mm`,
    `  - ความเร็วลม: ${weather.wind_speed_kmh} km/h`,
    `  - UV Index: ${weather.uv_index}`,
    `  - สภาพโดยรวม: ${weather.weather_description}`,
  ].join("\n");
}

function buildPlotContext(input: InspectionInput): string {
  return [
    `แปลง: ${input.plotName ?? input.plotId} (${input.plotId})`,
    `พิกัด: ${input.latitude}, ${input.longitude}${input.gpsAccuracyM ? ` (±${input.gpsAccuracyM}ม.)` : ""}`,
    `เวลาตรวจ: ${input.timestamp}`,
    `ผู้ตรวจ: ${input.inspectorName}`,
    input.notes ? `หมายเหตุ: ${input.notes}` : "",
  ].filter(Boolean).join("\n");
}

// แปลง Buffer → Gemini inline image part
function toImagePart(buffer: Buffer): Part {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function analyzeFieldInspection(
  input: InspectionInput
): Promise<DiagnosisResult> {

  const model = gemini.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.2,          // ต่ำ = ผลสม่ำเสมอ เหมาะ diagnosis
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  // สร้าง prompt รวม context ทั้งหมด
  const userPrompt = [
    "วิเคราะห์สภาพพืชจากภาพถ่ายภาคสนามนี้",
    "",
    buildPlotContext(input),
    "",
    buildWeatherContext(input.weather, input.location),
    "",
    "คำถามหลัก: พืชในภาพมีปัญหาอะไร?",
    "ให้วิเคราะห์ครบทั้ง 5 หมวด พร้อมระบุแหล่งอ้างอิงทุกข้อ",
  ].join("\n");

  // สร้าง content parts: รูป + text
  const imageParts: Part[] = input.images.map(toImagePart);

  // เรียก Gemini พร้อม timeout 60 วินาที
  const responsePromise = model.generateContent([...imageParts, userPrompt]);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini timeout after 60s")), 60_000)
  );

  const response = await Promise.race([responsePromise, timeoutPromise]);
  const text = response.response.text().trim();

  // parse JSON — Gemini ใช้ responseMimeType: "application/json" ให้ JSON ตรงอยู่แล้ว
  // แต่ strip ``` ออกกรณี model ใส่มาเผื่อ
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  const raw = JSON.parse(cleaned) as DiagnosisResult;

  // ตรวจสอบขั้นต่ำ — diagnoses ต้องมี references อย่างน้อย 1 ต่อ item
  for (const d of raw.diagnoses) {
    if (!d.references || d.references.length === 0) {
      d.references = [{
        citation: "กรมวิชาการเกษตร. คู่มือการวินิจฉัยโรคพืชเศรษฐกิจ. กระทรวงเกษตรและสหกรณ์.",
        refId: "doa-plant-disease-general",
      }];
    }
  }

  return raw;
}

// ─── Export helper ────────────────────────────────────────────────────────────

// แปลง weather_code → description (ให้ weatherService เรียกใช้)
export { describeWeatherCode };
