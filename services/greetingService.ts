
const IN_MSGS = ['ลุยกันเลยวันนี้!', 'ขอให้เป็นวันที่ดีนะครับ', 'พร้อมแล้ว ไปกันเลย!', 'วันนี้ต้องดีแน่นอน', 'สู้ๆ นะครับ'];
const OUT_MSGS = ['เหนื่อยหน่อย พักผ่อนให้เต็มที่นะครับ', 'วันนี้ทำได้ดีมาก!', 'กลับบ้านปลอดภัยครับ', 'ขอบคุณสำหรับวันนี้ครับ'];

export const getDailyInsight = (name: string, type: 'in' | 'out'): string => {
  const list = type === 'in' ? IN_MSGS : OUT_MSGS;
  return `คุณ${name} ${list[Math.floor(Math.random() * list.length)]}`;
};
