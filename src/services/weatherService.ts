import axios from "axios";
import type { WeatherData } from "../types/inspection.types";

// Open-Meteo — ฟรี ไม่ต้อง API key
// docs: open-meteo.com/en/docs

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// แปลง weather_code → คำอธิบายภาษาไทย
// https://open-meteo.com/en/docs#weathervariables
function describeWeatherCode(code: number): string {
  if (code === 0)            return "ท้องฟ้าแจ่มใส";
  if (code <= 2)             return "มีเมฆบางส่วน";
  if (code === 3)            return "มีเมฆมาก";
  if (code >= 45 && code <= 48) return "มีหมอก";
  if (code >= 51 && code <= 57) return "ฝนละออง";
  if (code >= 61 && code <= 67) return "ฝนตก";
  if (code >= 71 && code <= 77) return "หิมะ";
  if (code >= 80 && code <= 82) return "ฝนตกหนัก";
  if (code >= 95 && code <= 99) return "พายุฝนฟ้าคะนอง";
  return "สภาพอากาศไม่ทราบ";
}

export async function getWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const { data } = await axios.get(OPEN_METEO_URL, {
    params: {
      latitude,
      longitude,
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "wind_speed_10m",
        "uv_index",
        "weather_code",
      ].join(","),
      timezone: "Asia/Phnom_Penh",
    },
    timeout: 10_000,
  });

  const c = data.current;

  return {
    temperature_c:       Math.round(c.temperature_2m * 10) / 10,
    humidity_pct:        c.relative_humidity_2m,
    precipitation_mm:    c.precipitation,
    wind_speed_kmh:      Math.round(c.wind_speed_10m * 10) / 10,
    uv_index:            c.uv_index,
    weather_description: describeWeatherCode(c.weather_code),
  };
}
