// สร้างไฟล์ .md สรุปผลการตรวจแปลง 1 เคส
// ออกแบบให้อ่านง่ายสำหรับทั้งมนุษย์และระบบ (GitHub, Notion, Drive preview)

import type { InspectRequest, InspectResult, Diagnosis } from "../inspect/schemas";
import type { UploadedImage } from "./drive.service";

const SEVERITY_LABEL: Record<number, string> = {
  0: "ปกติ ✅",
  1: "เล็กน้อย 🟡",
  2: "เล็กน้อย-ปานกลาง 🟠",
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

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCategorySummaryTable(summary: InspectResult["category_summary"]): string {
  const rows = Object.entries(summary).map(([cat, found]) => {
    const label = CATEGORY_LABEL[cat] ?? cat;
    const status = found ? "✅ พบ" : "➖ ไม่พบ";
    return `| ${label} | ${status} |`;
  });

  return [
    "| หมวด | ผลตรวจ |",
    "|------|--------|",
    ...rows,
  ].join("\n");
}

function buildDiagnosisSection(d: Diagnosis, index: number): string {
  const severityLabel = SEVERITY_LABEL[d.severity] ?? `ระดับ ${d.severity}`;
  const categoryLabel = CATEGORY_LABEL[d.type] ?? d.type;
  const refList = d.references
    .map((r) => `  - ${r.citation}${r.ref_id ? ` *(ID: ${r.ref_id})*` : ""}`)
    .join("\n");
  const symptomList = d.observed_symptoms.map((s) => `  - ${s}`).join("\n");

  return `
### ${index + 1}. ${d.name_th} *(${d.name_en})*

| ฟิลด์ | ข้อมูล |
|-------|--------|
| หมวด | ${categoryLabel} |
| ชื่อวิทยาศาสตร์ | ${d.scientific_name ?? "-"} |
| ความรุนแรง | ${severityLabel} (${d.severity}/5) |
| ความมั่นใจ | ${d.confidence.toFixed(1)}% |

**อาการที่สังเกตพบ:**
${symptomList}

**เหตุผลการวินิจฉัย:**
> ${d.reasoning}

**คำอธิบาย:**
${d.description}

**คำแนะนำการแก้ไข:**
> 💊 ${d.recommendation}

**แหล่งอ้างอิง:**
${refList}
`.trimStart();
}

function buildImageSection(images: UploadedImage[]): string {
  if (images.length === 0) return "_ไม่มีรูปภาพ_";
  return images
    .map((img, i) => `${i + 1}. [${img.fileName}](${img.webViewLink})`)
    .join("\n");
}

// ─── Public Function ───────────────────────────────────────────────────────────

export function buildInspectionReport(
  req: InspectRequest,
  result: InspectResult,
  images: UploadedImage[]
): string {
  const overallLabel = SEVERITY_LABEL[result.overall_severity] ?? `ระดับ ${result.overall_severity}`;
  const foundCategories = Object.entries(result.category_summary)
    .filter(([, found]) => found)
    .map(([cat]) => CATEGORY_LABEL[cat] ?? cat);
  const problemSummary = foundCategories.length > 0
    ? foundCategories.join(", ")
    : "ไม่พบปัญหา — สภาพปกติ";

  const diagnosisSections = result.diagnoses.length > 0
    ? result.diagnoses.map((d, i) => buildDiagnosisSection(d, i)).join("\n---\n")
    : "_ไม่พบปัญหาใดๆ — พืชมีสภาพปกติ_";

  const observationList = result.primary_observations.length > 0
    ? result.primary_observations.map((o) => `- ${o}`).join("\n")
    : "- ไม่พบอาการผิดปกติ";

  return `# รายงานการตรวจแปลงเกษตร

> สร้างอัตโนมัติโดย Field Inspection AI — ${formatTimestamp(req.timestamp)}

---

## ข้อมูลการตรวจ

| ฟิลด์ | ข้อมูล |
|-------|--------|
| แปลง | ${req.plot_name ?? req.plot_id} |
| รหัสแปลง | \`${req.plot_id}\` |
| ผู้ตรวจ | ${req.inspector_name} |
| วันที่ / เวลา | ${formatTimestamp(req.timestamp)} |
| พิกัด GPS | ${req.latitude}, ${req.longitude}${req.gps_accuracy_m ? ` (±${req.gps_accuracy_m} ม.)` : ""} |
| หมายเหตุ | ${req.notes ?? "-"} |

---

## ผลสรุปภาพรวม

**ความรุนแรงโดยรวม:** ${overallLabel}

**ปัญหาที่พบ:** ${problemSummary}

**สรุปจาก AI:**
> ${result.summary}

### ผลตรวจแยกตาม 5 หมวด

${buildCategorySummaryTable(result.category_summary)}

---

## อาการที่สังเกตพบจากรูปภาพ

${observationList}

---

## รายละเอียดการวินิจฉัย

${diagnosisSections}

---

## รูปภาพที่บันทึก

${buildImageSection(images)}

---

*รายงานนี้สร้างด้วย AI — ควรตรวจสอบยืนยันกับผู้เชี่ยวชาญก่อนดำเนินการแก้ไข*
`;
}

// สร้าง filename สำหรับไฟล์ .md
export function buildReportFileName(req: InspectRequest): string {
  const dateStr = req.timestamp.replace(/[-:T]/g, "").slice(0, 15); // 20260618_093200
  const plotSlug = req.plot_id.replace(/[^a-zA-Z0-9]/g, "-");
  return `${dateStr}_${plotSlug}_report.md`;
}
