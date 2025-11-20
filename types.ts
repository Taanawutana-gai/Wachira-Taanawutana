export interface User {
  username: string;
  fullName: string;
}

export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT'
}

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  type: LogType;
  timestamp: number; // Date.now()
  location: GeoLocationData;
  aiMessage?: string; // Optional motivational message
}

export interface DailyStats {
  day: string;
  hours: number;
}