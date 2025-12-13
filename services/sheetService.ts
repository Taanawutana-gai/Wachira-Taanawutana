import { GeoLocationData, LogType, ApiResponse } from '../types';

// Hardcoded URL from Work Instruction
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzRLM_RwhNSt7jhndPmcCFOTMMFgsd0H1jU-F5oqAOKWFEoQAN6HlesUtc4hQKHhxmTxA/exec';

export const loginUser = async (username: string, password: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'LOGIN_USER',
        username: username,
        password: password
      })
    });
    return await response.json();
  } catch (error) {
    console.error("Login Error:", error);
    return { success: false, message: "Connection failed" };
  }
};

export const sendClockAction = async (
  username: string, 
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
        username: username,
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