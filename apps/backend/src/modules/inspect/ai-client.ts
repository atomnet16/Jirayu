// ai-client.ts — Gemini fallback (ฟรี 1,500 req/วัน)
// Primary อยู่ใน agent.ts (Claude)

import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { env } from "../../lib/env";
import { InspectResultSchema, type InspectResult, type InspectRequest } from "./schemas";
import { buildDifferentialGuide } from "./symptom-classifier";
import { formatReferencesForPrompt } from "./references.db";

const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const ALL_CATEGORIES = ["disease", "pest", "weather", "nutrient", "chemical"] as const;

// Gemini fallback — single-pass เพราะต้องเร็ว ไม่ multi-step
const GEMINI_PROMPT = `คุณคือนักพฤกษวิทยาและผู้เชี่ยวชาญโรคพืชในกัมพูชา
วิเคราะห์รูปภาพพืชแบบเปรียบเทียบ 5 หมวด:

${buildDifferentialGuide()}

แหล่งอ้างอิงที่ใช้ได้:
${formatReferencesForPrompt([...ALL_CATEGORIES])}

กฎ: ตอบ JSON เท่านั้น ห้าม markdown ห้าม text นอก JSON
references อย่างน้อย 1 รายการต่อ diagnosis, ต้องมี reasoning และ observed_symptoms

format:
{
  "primary_observations": ["..."],
  "diagnoses": [{
    "type": "disease|pest|weather|nutrient|chemical",
    "name_th": "...", "name_en": "...", "scientific_name": "...",
    "severity": 1, "confidence": 85,
    "observed_symptoms": ["..."],
    "reasoning": "...",
    "description": "...", "recommendation": "...",
    "references": [{ "citation": "...", "ref_id": "..." }]
  }],
  "category_summary": { "disease": false, "pest": false, "weather": false, "nutrient": false, "chemical": false },
  "overall_severity": 0,
  "summary": "..."
}`;

export async function analyzeWithGeminiFallback(
  images: string[],
  req: InspectRequest
): Promise<InspectResult> {
  const model = gemini.getGenerativeModel({
    model: "gemini-1.5-flash", // ฟรี 1,500 req/วัน
    generationConfig: {
      maxOutputTokens: 3000,
      temperature: 0.2, // ต่ำ = ผลสม่ำเสมอ เหมาะกับ diagnosis
    },
  });

  const contextText = [
    `แปลง: ${req.plot_name ?? req.plot_id} (${req.plot_id})`,
    `พิกัด: ${req.latitude}, ${req.longitude}`,
    `เวลา: ${req.timestamp}`,
    req.notes ? `หมายเหตุ: ${req.notes}` : "",
  ].filter(Boolean).join("\n");

  // แปลง base64 → Gemini Part format
  const imageParts: Part[] = images.map((img) => ({
    inlineData: { data: img, mimeType: "image/jpeg" },
  }));

  const response = await model.generateContent([
    GEMINI_PROMPT,
    ...imageParts,
    contextText,
  ]);

  const text = response.response.text().trim();

  // Gemini บางครั้งใส่ ```json ``` ครอบมา — strip ออก
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");

  return InspectResultSchema.parse(JSON.parse(cleaned));
}
