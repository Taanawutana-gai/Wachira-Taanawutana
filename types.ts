
export interface User {
  username: string;
  password?: string;
  name: string;
  siteId: string;
  role: 'Fixed' | 'Roaming' | 'Supervisor';
  position: string;
  avatarUrl?: string;
}

export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT'
}

export enum OTStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

export interface OTRequest {
  id: string;
  staffId: string;
  name: string;
  date: string;
  reason: string;
  hours: number;
  status: OTStatus;
  approverName?: string;
  timestamp: string;
}

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface AttendanceLog {
  id: string;
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
  otRequests?: OTRequest[];
}
