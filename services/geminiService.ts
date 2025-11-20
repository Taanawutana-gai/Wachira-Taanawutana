import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || ''; // Fallback empty string if not set (logic should handle check)
const ai = new GoogleGenAI({ apiKey });

export const getDailyInsight = async (username: string, type: 'in' | 'out', timeStr: string): Promise<string> => {
  if (!apiKey) return "Have a great day!";

  try {
    const prompt = type === 'in'
      ? `Generate a very short (max 15 words), punchy, motivational welcome message for ${username} who just clocked in at ${timeStr}. Focus on productivity or positivity.`
      : `Generate a very short (max 15 words) relaxing farewell message for ${username} who just clocked out at ${timeStr}. Focus on rest or good job.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || (type === 'in' ? "Let's make today count!" : "Great work today!");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return type === 'in' ? "Welcome back!" : "See you next time!";
  }
};