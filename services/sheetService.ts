
import { GeoLocationData, LogType, ApiResponse } from '../types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9QYN35eosWENrrN9fqop76Zf3gaYrbrbr9xUOUAAyziDWp1LnhVZq1VdXlt8muEnkuw/exec';
const TIMEOUT_MS = 30000;

// ส่งคำขอไป Apps Script พร้อมแยกสาเหตุ error และลองใหม่อัตโนมัติ
// รอแบบสุ่ม 2–6 วินาทีก่อนลองใหม่ ให้คำขอของคนจำนวนมากกระจายตัว ไม่ชนกันซ้ำ
// (เซิร์ฟเวอร์กันบันทึกซ้ำภายใน 2 นาทีอยู่แล้ว จึงลองใหม่ได้อย่างปลอดภัย)
const postToScript = async (payload: object, retries = 3): Promise<ApiResponse> => {
  let lastError = 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 + Math.random() * 4000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        // Google ส่งหน้า HTML error กลับมา เช่น มีคนใช้งานพร้อมกันมากเกินไป
        console.error('Non-JSON response:', response.status, text.slice(0, 500));
        lastError = `เซิร์ฟเวอร์ไม่ว่าง (HTTP ${response.status}) กรุณาลองใหม่`;
      }
    } catch (err: any) {
      // หมดเวลา: ไม่ลองซ้ำ เพราะเซิร์ฟเวอร์อาจบันทึกไปแล้ว
      if (err?.name === 'AbortError') return { success: false, message: 'หมดเวลาเชื่อมต่อ ระบบอาจบันทึกไปแล้ว กรุณารอสักครู่แล้วลองใหม่' };
      lastError = 'ไม่มีสัญญาณอินเทอร์เน็ต กรุณาลองใหม่';
    } finally {
      clearTimeout(timer);
    }
  }
  return { success: false, message: lastError };
};

export const loginUser = (username: string, password: string): Promise<ApiResponse> =>
  postToScript({ action: 'LOGIN_USER', username, password });

export const sendClockAction = (username: string, type: LogType, location: GeoLocationData, selectedSiteId?: string): Promise<ApiResponse> =>
  postToScript({
    action: type,
    username,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    selectedSiteId
  });
