import { AttendanceLog, User } from '../types';

const LOGS_KEY = 'geoclock_logs';
const USER_KEY = 'geoclock_user';
const SHEET_CONF_KEY = 'geoclock_sheet_conf';

export const saveUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): User | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const logoutUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

export const saveLog = (log: AttendanceLog): void => {
  const logs = getLogs();
  logs.push(log);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
};

export const getLogs = (): AttendanceLog[] => {
  const data = localStorage.getItem(LOGS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getLogsByUser = (username: string): AttendanceLog[] => {
  return getLogs().filter(log => log.userId === username);
};

export const saveSheetUrl = (url: string): void => {
  localStorage.setItem(SHEET_CONF_KEY, url);
};

export const getSheetUrl = (): string => {
  return localStorage.getItem(SHEET_CONF_KEY) || '';
};