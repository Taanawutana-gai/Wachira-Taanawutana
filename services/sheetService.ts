import { GeoLocationData, LogType, ApiResponse } from '../types';

// TODO: UPDATE THIS URL AFTER "NEW DEPLOYMENT"
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwz8Vuhfls9JHuguJYY0ZXmoObAqIfRpV5_LPW7i2r6QJ25-1DbTEpdYrEZVBh00dieiw/exec';

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

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON response:", text);
      return { 
        success: false, 
        message: "Server Error: Script configuration mismatch. Please check Script URL and Deployment." 
      };
    }

  } catch (error) {
    console.error("Login Error:", error);
    return { success: false, message: "Connection failed. Please check internet." };
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
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: false, message: "Server Error: Invalid response." };
    }

  } catch (error) {
    console.error("Clock Action Error:", error);
    return { success: false, message: "Network error during clocking." };
  }
};