import type { InspectionInput, DiagnosisResult, Diagnosis } from "../types/inspection.types";
import type { UploadedFile } from "../services/googleDriveService";

// ─── Labels ───────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<number, string> = {
  0: "ปกติ ✅",
  1: "เล็กน้อย 🟡",
  2: "เล็กน้อย–ปานกลาง 🟠",
  3: "ปานกลาง 🔶",
  4: "รุนแรง 🔴",
  5: "รุนแรงมาก 🚨",
};

const CATEGORY_LABEL: Record<string, string> = {
  disease:  "🦠 โรคพืช",
  pest:     "🐛 แมลงศัตรูพืช",
  weather:  "🌤 สภาพอากาศ",
  nutrient: "🌿 ธาตุอาหารพืช",
  chemical: "⚗️ พิษสารเคมี",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("th-TH", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function buildCategorySummaryTable(summary: DiagnosisResult["categorySummary"]): string {
  return [
    "| หมวด | ผลตรวจ |",
    "|------|--------|",
    ...Object.entries(summary).map(([cat, found]) =>
      `| ${CATEGORY_LABEL[cat] ?? cat} | ${found ? "✅ พบ" : "➖ ไม่พบ"} |`
    ),
  ].join("\n");
}

function buildDiagnosisSection(d: Diagnosis, index: number): string {
  const symptoms = d.observedSymptoms.map((s) => `  - ${s}`).join("\n");
  const refs = d.references
    .map((r) => `  - ${r.citation}${r.refId ? ` *(${r.refId})*` : ""}`)
    .join("\n");

  return `### ${index + 1}. ${d.nameTh} *(${d.nameEn})*

| | |
|---|---|
| หมวด | ${CATEGORY_LABEL[d.category]} |
| ชื่อวิทยาศาสตร์ | ${d.scientificName ?? "—"} |
| ความรุนแรง | ${SEVERITY_LABEL[d.severity]} (${d.severity}/5) |
| ความมั่นใจ | ${d.confidence}% |

**อาการที่พบ:**
${symptoms}

**เหตุผลการวินิจฉัย:**
> ${d.reasoning}

**คำอธิบาย:** ${d.description}

**คำแนะนำ:**
> 💊 ${d.recommendation}

**แหล่งอ้างอิง:**
${refs}`;
}

function buildWeatherSection(input: InspectionInput): string {
  const w = input.weather;
  return `| รายการ | ค่า |
|--------|-----|
| อุณหภูมิ | ${w.temperature_c} °C |
| ความชื้น | ${w.humidity_pct}% |
| ปริมาณฝน (1 ชม.) | ${w.precipitation_mm} mm |
| ความเร็วลม | ${w.wind_speed_kmh} km/h |
| UV Index | ${w.uv_index} |
| สภาพโดยรวม | ${w.weather_description} |`;
}

function buildImageSection(imageFiles: UploadedFile[]): string {
  if (imageFiles.length === 0) return "_ไม่มีรูปภาพ_";
  return imageFiles
    .map((f, i) => `${i + 1}. [${f.name}](${f.webViewLink})`)
    .join("\n");
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function buildReportMarkdown(
  input: InspectionInput,
  result: DiagnosisResult,
  imageFiles: UploadedFile[] = []   // ใส่หลัง upload Drive เพื่อฝัง link จริง
): string {
  const loc = input.location;
  const locationFull = [loc.village, loc.district, loc.province, loc.country]
    .filter(Boolean)
    .join(", ") || loc.display_name;

  const overallLabel = SEVERITY_LABEL[result.overallSeverity] ?? `ระดับ ${result.overallSeverity}`;

  const foundCategories = Object.entries(result.categorySummary)
    .filter(([, found]) => found)
    .map(([cat]) => CATEGORY_LABEL[cat] ?? cat);

  const problemSummary = foundCategories.length > 0
    ? foundCategories.join(", ")
    : "ไม่พบปัญหา — สภาพปกติ";

  const diagnosisSections = result.diagnoses.length > 0
    ? result.diagnoses.map((d, i) => buildDiagnosisSection(d, i)).join("\n\n---\n\n")
    : "_ไม่พบปัญหาใดๆ — พืชมีสภาพปกติ_";

  const observationList = result.primaryObservations.length > 0
    ? result.primaryObservations.map((o) => `- ${o}`).join("\n")
    : "- ไม่พบอาการผิดปกติ";

  return `# รายงานการตรวจแปลงเกษตร

> สร้างอัตโนมัติโดย Mega Farm Field Inspection AI — ${formatTimestamp(input.timestamp)}

---

## ข้อมูลการตรวจ

| รายการ | ข้อมูล |
|--------|--------|
| แปลง | ${input.plotName ?? input.plotId} |
| รหัสแปลง | \`${input.plotId}\` |
| ผู้ตรวจ | ${input.inspectorName} |
| วันที่ / เวลา | ${formatTimestamp(input.timestamp)} |
| สถานที่ | ${locationFull} |
| พิกัด GPS | ${input.latitude}, ${input.longitude}${input.gpsAccuracyM ? ` (±${input.gpsAccuracyM} ม.)` : ""} |
| หมายเหตุ | ${input.notes ?? "—"} |

---

## สภาพอากาศ ณ เวลาตรวจ

${buildWeatherSection(input)}

**ผลกระทบจากอากาศ:** ${result.weatherInfluence}

---

## ผลสรุปภาพรวม

**ความรุนแรงโดยรวม:** ${overallLabel}
**ปัญหาที่พบ:** ${problemSummary}

> ${result.summary}

### ผลตรวจ 5 หมวด

${buildCategorySummaryTable(result.categorySummary)}

---

## อาการที่สังเกตพบจากรูป

${observationList}

---

## รายละเอียดการวินิจฉัย

${diagnosisSections}

---

## รูปภาพที่บันทึก

${buildImageSection(imageFiles)}

---

*รายงานนี้ใช้ AI ประกอบการวินิจฉัย — ควรตรวจสอบกับผู้เชี่ยวชาญก่อนดำเนินการแก้ไข*
*Mega Farm Cambodia · Field Inspection System v1.0*
`;
}
