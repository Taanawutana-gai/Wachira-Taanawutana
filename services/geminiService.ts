
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getDailyInsight = async (username: string, type: 'in' | 'out', timeStr: string): Promise<string> => {
  if (!apiKey) return "ขอให้เป็นวันที่ดี!";

  try {
    const prompt = type === 'in'
      ? `สร้างข้อความต้อนรับสั้นๆ (ไม่เกิน 15 คำ) ให้คุณ ${username} ที่เพิ่งบันทึกเข้างานเวลา ${timeStr} เน้นพลังบวกและการทำงาน`
      : `สร้างข้อความบอกลาพักผ่อนสั้นๆ (ไม่เกิน 15 คำ) ให้คุณ ${username} ที่เพิ่งบันทึกออกงานเวลา ${timeStr} เน้นความภูมิใจในงานและการพักผ่อน`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || (type === 'in' ? "ลุยกันเลยวันนี้!" : "พักผ่อนให้เต็มที่ครับ!");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return type === 'in' ? "ยินดีต้อนรับกลับมา!" : "ไว้พบกันใหม่ครับ!";
  }
};
