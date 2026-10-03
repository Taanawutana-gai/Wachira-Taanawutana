
export interface User {
  username: string; // This will be the LINE User ID
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

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface Site {
  id: string;
  name: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  user?: User;
  logs?: any[];
  sites?: Site[];
}
