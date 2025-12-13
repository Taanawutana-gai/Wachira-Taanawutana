export interface User {
  username: string;
  password?: string;
  name: string;
  siteId: string;
  role: 'Fixed' | 'Roaming';
  shiftGroup: string;
  avatarUrl?: string;
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
  id: string; // Used for UI key
  userId?: string;
  date: string;
  clockInTime?: string;
  clockOutTime?: string;
  workingHours?: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  user?: User;
  logs?: any[];
}