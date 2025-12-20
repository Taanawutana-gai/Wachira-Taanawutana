
import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AttendanceStatsProps {
  logs: any[];
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ logs }) => {
  const processData = () => {
    // 1. Create a map of the last 7 days
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

    // 2. Aggregate hours from real logs
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

  const data = processData();
  const totalHours = data.reduce((acc, curr) => acc + curr.hours, 0).toFixed(1);
  const avgHours = (parseFloat(totalHours) / 7).toFixed(1);
  const activeDays = data.filter(d => d.hours > 0).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Hrs</span>
            <span className="text-lg font-black text-blue-600">{totalHours}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Avg/Day</span>
            <span className="text-lg font-black text-indigo-600">{avgHours}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Days</span>
            <span className="text-lg font-black text-slate-700">{activeDays}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full h-64">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex justify-between items-center">
          Weekly Performance
          <span className="text-[10px] font-normal normal-case bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Last 7 Days</span>
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
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
               {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.hours > 0 ? (index === data.length - 1 ? '#2563eb' : '#6366f1') : '#f1f5f9'} 
                  />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
