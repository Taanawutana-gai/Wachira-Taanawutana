import { GeoLocationData, LogType, ApiResponse } from '../types';

// Hardcoded URL from Work Instruction
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_3_9XdI6EKiG2otT9pRPrUAzo77t1ftN8Lw3p3eALrDS_efVCs7A7_zt87tFLqhIf/exec';

export const checkUserStatus = async (lineUserId: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'CHECK_USER',
        lineUserId: lineUserId
      })
    });
    return await response.json();
  } catch (error) {
    console.error("Check Status Error:", error);
    return { success: false, message: "Connection failed" };
  }
};

export const sendClockAction = async (
  lineUserId: string, 
  type: LogType, 
  location: GeoLocationData
): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: type, // CLOCK_IN or CLOCK_OUT
        lineUserId: lineUserId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      })
    });
    return await response.json();
  } catch (error) {
    console.error("Clock Action Error:", error);
    return { success: false, message: "Network error during clocking." };
  }
};