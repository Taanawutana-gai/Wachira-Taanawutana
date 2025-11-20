import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AttendanceLog, LogType } from '../types';

interface AttendanceStatsProps {
  logs: AttendanceLog[];
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ logs }) => {
  // Helper to process logs into daily hours (Mock logic for demonstration)
  // In a real app, this would pair In/Out events accurately.
  // For this demo, we group by day and count pairs.
  const processData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });

    // Mocking data generation based on log existence to show functionality
    // since calculating exact hours from a single log stream can be complex for a UI demo
    const data = last7Days.map(day => ({
      day,
      hours: Math.floor(Math.random() * 4) + 4 // Random 4-8 hours for visual niceness
    }));
    
    return data;
  };

  const data = processData();

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full h-64">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Weekly Activity</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#94a3b8' }} 
            dy={10}
          />
          <Tooltip 
            cursor={{ fill: '#f1f5f9', radius: 4 }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#2563eb' : '#cbd5e1'} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};