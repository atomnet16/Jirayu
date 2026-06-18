import axios from "axios";
import type { LocationData } from "../types/inspection.types";

// Nominatim (OpenStreetMap) — ฟรี ไม่ต้อง API key
// กฎ: ต้องใส่ User-Agent และไม่เกิน 1 req/วินาที
// docs: nominatim.org/release-docs/develop/api/Reverse/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

export async function getLocation(
  latitude: number,
  longitude: number
): Promise<LocationData> {
  const { data } = await axios.get(NOMINATIM_URL, {
    params: {
      lat: latitude,
      lon: longitude,
      format: "json",
      addressdetails: 1,
    },
    headers: {
      // Nominatim บังคับให้ระบุ User-Agent
      "User-Agent": "MegaFarmFieldInspection/1.0 (atomnet16@gmail.com)",
      "Accept-Language": "th,en",
    },
    timeout: 10_000,
  });

  const addr = data.address ?? {};

  return {
    display_name: data.display_name ?? `${latitude}, ${longitude}`,
    village:  addr.village  ?? addr.hamlet   ?? addr.suburb   ?? undefined,
    district: addr.county   ?? addr.district ?? addr.town     ?? undefined,
    province: addr.state    ?? addr.province ?? undefined,
    country:  addr.country  ?? undefined,
  };
}
