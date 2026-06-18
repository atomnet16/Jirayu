// AI Agent หลายขั้นตอน — วิเคราะห์เปรียบเทียบอาการพืชแบบ structured
//
// ขั้นตอนการทำงาน:
//   Step 1 — Observe:  AI สังเกตอาการที่มองเห็นในรูปโดยไม่ด่วนสรุป
//   Step 2 — Classify: AI เปรียบเทียบอาการกับ 5 หมวด พร้อม reasoning
//   Step 3 — Cite:     AI เลือกแหล่งอ้างอิงที่ตรงกับการวินิจฉัย
//   Step 4 — Validate: ตรวจสอบ output ด้วย Zod — retry 1 ครั้งถ้า parse ไม่ผ่าน

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../lib/env";
import { InspectResultSchema, type InspectResult, type InspectRequest } from "./schemas";
import { buildDifferentialGuide } from "./symptom-classifier";
import { formatReferencesForPrompt } from "./references.db";

const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ─── Step 1: Observe ─────────────────────────────────────────────────────────
// ให้ AI บรรยายสิ่งที่เห็นในรูปก่อน โดยยังไม่วินิจฉัย
// วิธีนี้ลด hallucination เพราะ AI ต้องยึดกับรูปก่อน

const OBSERVE_SYSTEM = `คุณคือนักพฤกษวิทยาผู้เชี่ยวชาญ
งานของคุณตอนนี้: บรรยายสิ่งที่เห็นในรูปภาพอย่างละเอียด เป็นกลาง ยังไม่ต้องวินิจฉัย
รูปแบบที่ต้องการ (JSON เท่านั้น):
{
  "observations": [
    "อาการที่ 1 ที่มองเห็นชัดเจน",
    "อาการที่ 2",
    ...
  ],
  "affected_parts": ["ใบ", "ก้าน", "ราก", ...],
  "severity_impression": "ความรุนแรงที่เห็นโดยรวม (เบา/ปานกลาง/รุนแรง)"
}`;

interface ObserveResult {
  observations: string[];
  affected_parts: string[];
  severity_impression: string;
}

async function stepObserve(images: string[], req: InspectRequest): Promise<ObserveResult> {
  const context = [
    `แปลง: ${req.plot_name ?? req.plot_id}`,
    `พิกัด: ${req.latitude}, ${req.longitude}`,
    `เวลา: ${req.timestamp}`,
    req.notes ? `หมายเหตุจากเจ้าหน้าที่: ${req.notes}` : "",
  ].filter(Boolean).join("\n");

  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: OBSERVE_SYSTEM,
    messages: [{
      role: "user",
      content: [
        ...images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const, data: img },
        })),
        { type: "text" as const, text: context },
      ],
    }],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Unexpected response in observe step");
  return JSON.parse(text.text.trim()) as ObserveResult;
}

// ─── Step 2 & 3: Classify + Cite ─────────────────────────────────────────────
// ส่ง observations จาก Step 1 + คู่มือเปรียบเทียบอาการ 5 หมวด
// พร้อม reference database ให้ AI เลือกอ้างอิงที่ถูกต้อง

const ALL_CATEGORIES = ["disease", "pest", "weather", "nutrient", "chemical"] as const;

function buildClassifySystem(): string {
  const referenceList = formatReferencesForPrompt([...ALL_CATEGORIES]);
  const differentialGuide = buildDifferentialGuide();

  return `คุณคือผู้เชี่ยวชาญวินิจฉัยโรคพืชและศัตรูพืช
งานของคุณ: นำ "อาการที่สังเกตได้" มาเปรียบเทียบกับ 5 หมวด และวินิจฉัยอย่างมีเหตุผล

═══════════════════════════════════════
คู่มือเปรียบเทียบอาการ 5 หมวด
═══════════════════════════════════════
${differentialGuide}

═══════════════════════════════════════
แหล่งอ้างอิงที่ได้รับอนุญาตให้ใช้ (ห้ามแต่งอ้างอิงเอง)
═══════════════════════════════════════
${referenceList}

═══════════════════════════════════════
กฎที่ต้องปฏิบัติ
═══════════════════════════════════════
1. ตอบเป็น JSON เท่านั้น ห้ามมี text นอก JSON
2. ทุก diagnosis ต้องมี references อย่างน้อย 1 รายการ (เลือกจากรายการข้างต้น)
3. ต้องระบุ reasoning ว่าทำไมถึงวินิจฉัยเป็นหมวดนี้ (ไม่ใช่หมวดอื่น)
4. ต้องระบุ observed_symptoms ที่ใช้ตัดสิน
5. category_summary ต้องครบ 5 หมวดเสมอ (true/false)
6. หากพืชปกติ ให้ diagnoses = [], overall_severity = 0

รูปแบบ JSON ที่ต้องการ:
{
  "primary_observations": ["สิ่งที่สังเกตได้หลักๆ จากรูป"],
  "diagnoses": [
    {
      "type": "disease|pest|weather|nutrient|chemical",
      "name_th": "ชื่อภาษาไทย",
      "name_en": "English name",
      "scientific_name": "Genus species (ถ้ามี)",
      "severity": 1,
      "confidence": 85,
      "observed_symptoms": ["อาการที่ 1 ที่ใช้ตัดสิน", "อาการที่ 2"],
      "reasoning": "เหตุผลที่วินิจฉัยเป็นหมวดนี้ และทำไมไม่ใช่หมวดอื่น",
      "description": "คำอธิบายสั้น",
      "recommendation": "คำแนะนำการแก้ไขที่ปฏิบัติได้",
      "references": [
        { "citation": "ชื่อผู้แต่ง (ปี). ชื่อหนังสือ. สำนักพิมพ์.", "ref_id": "id-จากรายการ" }
      ]
    }
  ],
  "category_summary": {
    "disease": false,
    "pest": true,
    "weather": false,
    "nutrient": false,
    "chemical": false
  },
  "overall_severity": 2,
  "summary": "สรุปภาพรวมสภาพพืชและคำแนะนำเร่งด่วน"
}`;
}

async function stepClassify(
  images: string[],
  req: InspectRequest,
  observations: ObserveResult
): Promise<{ result: InspectResult; rawText: string }> {
  const observeText = [
    `อาการที่สังเกตได้จากรูป:`,
    ...observations.observations.map((o) => `- ${o}`),
    `ส่วนที่ได้รับผลกระทบ: ${observations.affected_parts.join(", ")}`,
    `ความรุนแรงเบื้องต้น: ${observations.severity_impression}`,
    ``,
    `ข้อมูลแปลง:`,
    `แปลง: ${req.plot_name ?? req.plot_id} (${req.plot_id})`,
    `พิกัด: ${req.latitude}, ${req.longitude}`,
    `เวลาตรวจ: ${req.timestamp}`,
    req.notes ? `หมายเหตุ: ${req.notes}` : "",
  ].filter(Boolean).join("\n");

  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: buildClassifySystem(),
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data: img },
          })),
          { type: "text" as const, text: observeText },
        ],
      },
    ],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Unexpected response in classify step");

  const rawText = text.text.trim();
  const raw = JSON.parse(rawText);
  return { result: InspectResultSchema.parse(raw), rawText };
}

// ─── Step 4 (Retry): ถ้า parse ไม่ผ่าน ให้ AI แก้ JSON ──────────────────────

const FIX_SYSTEM = `คุณได้รับ JSON ที่มีโครงสร้างผิดพลาด
แก้ไข JSON ให้ถูกต้องตาม schema ที่กำหนด ตอบด้วย JSON เท่านั้น ห้าม text อื่น
ข้อกำหนดสำคัญ: ทุก diagnosis ต้องมี references อย่างน้อย 1 รายการ
format references: { "citation": "...", "ref_id": "..." }`;

async function stepFixAndRetry(
  brokenJson: string,
  validationError: string
): Promise<InspectResult> {
  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: FIX_SYSTEM,
    messages: [{
      role: "user",
      content: `JSON ที่ต้องแก้:\n${brokenJson}\n\nข้อผิดพลาด:\n${validationError}`,
    }],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Fix step failed");
  const raw = JSON.parse(text.text.trim());
  return InspectResultSchema.parse(raw);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runInspectAgent(
  images: string[],
  req: InspectRequest
): Promise<InspectResult> {
  // Step 1: สังเกตอาการก่อนวินิจฉัย
  const observations = await stepObserve(images, req);

  // Step 2+3: วินิจฉัย + อ้างอิง — เก็บ rawText ไว้สำหรับ retry
  let rawText = "";
  try {
    const { result, rawText: rt } = await stepClassify(images, req, observations);
    rawText = rt;
    return result;
  } catch (err) {
    // Step 4: ถ้า Zod validation หรือ JSON.parse ล้มเหลว ให้ AI แก้ JSON 1 ครั้ง
    if (err instanceof SyntaxError || (err as Error).name === "ZodError") {
      console.warn("[Agent] Validation failed, retrying fix step...");
      return await stepFixAndRetry(rawText, (err as Error).message);
    }
    throw err;
  }
}
