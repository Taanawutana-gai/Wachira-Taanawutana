
import { GeoLocationData, LogType, ApiResponse, OTStatus } from '../types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxe3D3on98vPqZio1qJ5Dkc8Vll4tcaTzhOh6nKw6I-2OopZI1w0CUmS5kVvpBo_ucFkw/exec';

export const loginUser = async (username: string, password: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'LOGIN_USER', username, password })
    });
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    return { success: false, message: "Connection failed." };
  }
};

export const sendClockAction = async (username: string, type: LogType, location: GeoLocationData): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: type,
        username,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      })
    });
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    return { success: false, message: "Network error." };
  }
};

export const requestOT = async (params: { staffId: string, name: string, siteId: string, startTime: string, endTime: string, reason: string, role: string }): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'REQUEST_OT', ...params })
    });
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    return { success: false, message: "Failed to request OT." };
  }
};

export const updateOTStatus = async (params: { requestId: string, status: OTStatus, approverName: string, staffId: string, role: string, siteId: string }): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'UPDATE_OT_STATUS', ...params })
    });
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    return { success: false, message: "Failed to update OT status." };
  }
};
