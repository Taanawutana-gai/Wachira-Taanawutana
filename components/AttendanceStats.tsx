
import * as React from 'react';

interface AttendanceStatsProps {
  logs: any[];
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ logs }) => {
  // ฟังก์ชันช่วยในการแปลงข้อความ "X ชม. Y นาที" ให้เป็นตัวเลขชั่วโมง (ทศนิยม)
  const parseWorkingHours = (value: any): number => {
    if (!value || value === "NaN นาที" || value === "ERR") return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    
    const str = String(value);
    
    // กรณีเป็นรูปแบบตัวเลขเดิม (เช่น "8.50")
    if (!isNaN(Number(str))) return parseFloat(str);
    
    let totalHours = 0;
    // ค้นหาตัวเลขหน้า "ชม." และ "นาที" โดยข้ามคำว่า NaN
    const hourMatch = str.match(/(\d+)\s*ชม/);
    const minMatch = str.match(/(\d+)\s*นาที/);
    
    if (hourMatch) totalHours += parseInt(hourMatch[1], 10);
    if (minMatch) totalHours += parseInt(minMatch[1], 10) / 60;
    
    return isNaN(totalHours) ? 0 : totalHours;
  };

  // คำนวณสถิติรายเดือน
  const calculateMonthlyStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); 
    const currentYear = now.getFullYear();

    let totalMonthHours = 0;
    const workedDaysSet = new Set<string>();

    logs.forEach(log => {
      if (log.dateIn) {
        const logDate = new Date(log.dateIn);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          const hours = parseWorkingHours(log.workingHours);
          totalMonthHours += hours;
          if (hours > 0) {
            workedDaysSet.add(log.dateIn);
          }
        }
      }
    });

    const daysWorked = workedDaysSet.size;
    const avgHours = daysWorked > 0 ? (totalMonthHours / daysWorked) : 0;

    return {
      total: totalMonthHours.toFixed(1),
      avg: avgHours.toFixed(1),
      days: daysWorked
    };
  };

  const monthlyStats = calculateMonthlyStats();

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 text-center leading-tight">Total Hrs<br/>(เดือนนี้)</span>
            <span className="text-lg font-black text-blue-600">{monthlyStats.total}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 text-center leading-tight">Avg/Day<br/>(เดือนนี้)</span>
            <span className="text-lg font-black text-indigo-600">{monthlyStats.avg}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 text-center leading-tight">Days<br/>(เดือนนี้)</span>
            <span className="text-lg font-black text-slate-700">{monthlyStats.days}</span>
        </div>
      </div>
    </div>
  );
};
