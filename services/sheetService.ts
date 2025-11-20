import { AttendanceLog } from '../types';

/**
 * Sends the attendance log to a Google Sheet via Google Apps Script Web App.
 * 
 * Note: This uses mode: 'no-cors' which allows the request to be sent to the 
 * script URL without reading the response. This is the standard way to interact 
 * with simple public GAS Web Apps from client-side JS.
 */
export const sendToGoogleSheet = async (url: string, log: AttendanceLog): Promise<boolean> => {
  if (!url) return false;

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors", 
      headers: {
        "Content-Type": "text/plain", // text/plain avoids preflight OPTIONS request which GAS often blocks
      },
      body: JSON.stringify(log),
    });
    return true;
  } catch (error) {
    console.error("Failed to sync to Google Sheet", error);
    return false;
  }
};