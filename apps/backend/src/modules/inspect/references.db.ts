// ฐานข้อมูลแหล่งอ้างอิงทางวิชาการ แยกตาม 5 หมวด
// AI จะดึงรายการที่เกี่ยวข้องไปแนบในผลวินิจฉัยทุกครั้ง

export type ProblemType = "disease" | "pest" | "weather" | "nutrient" | "chemical";

export interface Reference {
  id: string;
  title: string;
  author: string;
  year: number;
  publisher: string;
  category: ProblemType | "general";
  // คำสำคัญสำหรับ match กับอาการที่พบ
  keywords: string[];
}

export const REFERENCE_DB: Reference[] = [
  // ─── โรคพืช (disease) ────────────────────────────────────────────
  {
    id: "doa-plant-disease-2563",
    title: "คู่มือการวินิจฉัยโรคพืชเศรษฐกิจ",
    author: "กรมวิชาการเกษตร",
    year: 2020,
    publisher: "กรมวิชาการเกษตร กระทรวงเกษตรและสหกรณ์ ประเทศไทย",
    category: "disease",
    keywords: ["โรคพืช", "เชื้อรา", "แบคทีเรีย", "ไวรัส", "ใบไหม้", "ราน้ำค้าง", "แอนแทรคโนส"],
  },
  {
    id: "fao-plant-health-2021",
    title: "FAO Plant Health Guidelines: Crop Disease Management in Southeast Asia",
    author: "Food and Agriculture Organization of the United Nations (FAO)",
    year: 2021,
    publisher: "FAO, Rome",
    category: "disease",
    keywords: ["blight", "fungal", "bacterial", "viral", "mildew", "rust", "wilt"],
  },
  {
    id: "cabi-crop-protection-2022",
    title: "Crop Protection Compendium: Tropical Crop Diseases",
    author: "CABI International",
    year: 2022,
    publisher: "CAB International, Wallingford, UK",
    category: "disease",
    keywords: ["anthracnose", "leaf spot", "blight", "rot", "mosaic", "yellowing"],
  },
  {
    id: "cambodia-maize-disease-2019",
    title: "Common Maize Diseases in Cambodia and Their Management",
    author: "CIMMYT & Royal University of Agriculture, Cambodia",
    year: 2019,
    publisher: "CIMMYT",
    category: "disease",
    keywords: ["maize", "corn", "turcicum", "leaf blight", "stalk rot", "smut"],
  },

  // ─── แมลงศัตรูพืช (pest) ─────────────────────────────────────────
  {
    id: "doa-pest-management-2562",
    title: "แมลงศัตรูพืชและการป้องกันกำจัด",
    author: "กรมวิชาการเกษตร",
    year: 2019,
    publisher: "กรมวิชาการเกษตร กระทรวงเกษตรและสหกรณ์ ประเทศไทย",
    category: "pest",
    keywords: ["เพลี้ย", "หนอน", "ไร", "ด้วง", "แมลงวัน", "บั่ว", "แมลงหวี่"],
  },
  {
    id: "fao-ipm-guide-2020",
    title: "Integrated Pest Management for Rice, Maize and Vegetables in Southeast Asia",
    author: "FAO Regional Office for Asia and the Pacific",
    year: 2020,
    publisher: "FAO Bangkok",
    category: "pest",
    keywords: ["aphid", "thrips", "mite", "caterpillar", "stem borer", "whitefly", "leafhopper"],
  },
  {
    id: "cabi-invasive-pest-2023",
    title: "Invasive Pest Species in Southeast Asian Agriculture",
    author: "CABI International",
    year: 2023,
    publisher: "CAB International, Wallingford, UK",
    category: "pest",
    keywords: ["fall armyworm", "Spodoptera frugiperda", "brown planthopper", "Nilaparvata lugens"],
  },

  // ─── สภาพอากาศ (weather) ─────────────────────────────────────────
  {
    id: "irri-climate-stress-2022",
    title: "Managing Climate Stress in Rice and Field Crops",
    author: "International Rice Research Institute (IRRI)",
    year: 2022,
    publisher: "IRRI, Los Baños, Philippines",
    category: "weather",
    keywords: ["drought", "flood", "heat stress", "cold stress", "waterlogging", "wilting"],
  },
  {
    id: "doa-water-stress-2564",
    title: "การจัดการความเครียดจากน้ำในพืชเศรษฐกิจ",
    author: "กรมวิชาการเกษตร",
    year: 2021,
    publisher: "กรมวิชาการเกษตร กระทรวงเกษตรและสหกรณ์ ประเทศไทย",
    category: "weather",
    keywords: ["ขาดน้ำ", "น้ำท่วม", "แล้ง", "เหี่ยว", "ใบม้วน", "แดดร้อน", "อุณหภูมิ"],
  },

  // ─── ธาตุอาหารพืช (nutrient) ─────────────────────────────────────
  {
    id: "isss-soil-plant-nutrition-2020",
    title: "Soil Plant Nutrition and Nutrient Deficiency Diagnosis",
    author: "International Soil Science Society",
    year: 2020,
    publisher: "Springer, Berlin",
    category: "nutrient",
    keywords: ["nitrogen", "phosphorus", "potassium", "iron", "magnesium", "zinc", "deficiency", "chlorosis"],
  },
  {
    id: "doa-fertilizer-guide-2565",
    title: "คู่มือการใช้ปุ๋ยและการวินิจฉัยอาการขาดธาตุอาหาร",
    author: "กรมวิชาการเกษตร",
    year: 2022,
    publisher: "กรมวิชาการเกษตร กระทรวงเกษตรและสหกรณ์ ประเทศไทย",
    category: "nutrient",
    keywords: ["ขาดไนโตรเจน", "ขาดฟอสฟอรัส", "ขาดโพแทสเซียม", "ขาดเหล็ก", "ขาดแมกนีเซียม", "ใบเหลือง"],
  },
  {
    id: "fao-fertilizer-se-asia-2021",
    title: "Nutrient Management and Fertilizer Use in Southeast Asian Smallholder Farming",
    author: "FAO",
    year: 2021,
    publisher: "FAO, Rome",
    category: "nutrient",
    keywords: ["NPK", "micronutrient", "foliar spray", "soil pH", "leaching"],
  },

  // ─── พิษสารเคมี (chemical) ────────────────────────────────────────
  {
    id: "fao-pesticide-residue-2022",
    title: "FAO Manual on Safe Use of Pesticides and Chemical Toxicity in Crops",
    author: "FAO",
    year: 2022,
    publisher: "FAO, Rome",
    category: "chemical",
    keywords: ["herbicide", "pesticide", "toxicity", "phytotoxicity", "residue", "overdose"],
  },
  {
    id: "doa-pesticide-safety-2563",
    title: "คู่มือความปลอดภัยสารเคมีทางการเกษตรและผลกระทบต่อพืช",
    author: "กรมวิชาการเกษตร",
    year: 2020,
    publisher: "กรมวิชาการเกษตร กระทรวงเกษตรและสหกรณ์ ประเทศไทย",
    category: "chemical",
    keywords: ["พิษยาฆ่าแมลง", "ยากำจัดวัชพืช", "สารตกค้าง", "ใบไหม้จากสาร", "เกินขนาด"],
  },

  // ─── ทั่วไป ───────────────────────────────────────────────────────
  {
    id: "fao-crop-monitoring-2023",
    title: "Crop Monitoring and Field Assessment Guide for Smallholder Farmers",
    author: "FAO",
    year: 2023,
    publisher: "FAO, Rome",
    category: "general",
    keywords: ["field inspection", "crop monitoring", "visual assessment", "diagnosis"],
  },
];

// ดึงรายการอ้างอิงที่เกี่ยวข้องกับหมวดที่ระบุ
export function getReferencesForCategory(category: ProblemType): Reference[] {
  return REFERENCE_DB.filter(
    (ref) => ref.category === category || ref.category === "general"
  );
}

// แปลงเป็น string สำหรับแนบใน prompt
export function formatReferencesForPrompt(categories: ProblemType[]): string {
  const uniqueCategories = [...new Set(categories)];
  const refs = REFERENCE_DB.filter(
    (ref) => uniqueCategories.includes(ref.category as ProblemType) || ref.category === "general"
  );

  return refs
    .map((r) => `- ${r.author} (${r.year}). "${r.title}". ${r.publisher}. [ID: ${r.id}]`)
    .join("\n");
}

// แปลง Reference object เป็น citation string สำหรับใส่ใน response
export function toCitation(ref: Reference): string {
  return `${ref.author} (${ref.year}). "${ref.title}". ${ref.publisher}.`;
}
