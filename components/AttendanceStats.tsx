
import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AttendanceStatsProps {
  logs: any[];
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ logs }) => {
  // กรองและประมวลผลข้อมูลสำหรับกราฟ 7 วันล่าสุด
  const processChartData = () => {
    const last7DaysMap: Record<string, { day: string, date: string, hours: number }> = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      last7DaysMap[dateKey] = {
        day: days[d.getDay()],
        date: dateKey,
        hours: 0
      };
    }

    logs.forEach(log => {
      if (log.dateIn && last7DaysMap[log.dateIn]) {
        last7DaysMap[log.dateIn].hours += parseFloat(log.workingHours || 0);
      }
    });

    return Object.values(last7DaysMap).map(item => ({
      ...item,
      hours: parseFloat(item.hours.toFixed(2))
    }));
  };

  // คำนวณสถิติรายเดือน
  const calculateMonthlyStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    let totalMonthHours = 0;
    const workedDaysSet = new Set<string>();

    logs.forEach(log => {
      if (log.dateIn) {
        const logDate = new Date(log.dateIn);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          const hours = parseFloat(log.workingHours || 0);
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

  const chartData = processChartData();
  const monthlyStats = calculateMonthlyStats();

  return (
    <div className="space-y-4">
      {/* Summary Cards - สถิติรายเดือน */}
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

      {/* Chart - แสดงแนวโน้มรายสัปดาห์ */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full h-64">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex justify-between items-center">
          Weekly Performance
          <span className="text-[10px] font-normal normal-case bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">7 วันล่าสุด</span>
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
              dy={10}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc', radius: 8 }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
              formatter={(value: any) => [`${value} hrs`, 'Work Time']}
            />
            <Bar dataKey="hours" radius={[6, 6, 0, 0]} barSize={24}>
               {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.hours > 0 ? (index === chartData.length - 1 ? '#2563eb' : '#6366f1') : '#f1f5f9'} 
                  />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
