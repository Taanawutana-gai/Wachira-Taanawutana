
/**
 * GEO CLOCK AI - BACKEND (Overnight Calculation Support)
 * 
 * LOGS STRUCTURE:
 * A: Staff_ID, B: Name, C: Date_Clock_in, D: Clock_In_Time, E: In_Lat, F: In_Lng
 * G: Date_Clock_out, H: Clock_Out_Time, I: Out_Lat, J: Out_Lng, K: Site_ID, L: Working_Hours
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";
const TIMEZONE = "Asia/Bangkok"; 

function doGet(e) {
  return ContentService.createTextOutput("GeoClock AI Backend is Running. Overnight Support enabled.");
}

function doPost(e) {
  const output = { success: false, message: "Unknown Error" };
  try {
    if (!e.postData || !e.postData.contents) return sendJSON({ success: false, message: "No data" });
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "LOGIN_USER") return sendJSON(handleLogin(data.username, data.password));
    if (data.action === "CLOCK_IN") return sendJSON(handleClockIn(data));
    if (data.action === "CLOCK_OUT") return sendJSON(handleClockOut(data));
    
    return sendJSON({ success: false, message: "Invalid Action" });
  } catch (error) {
    return sendJSON({ success: false, message: error.toString() });
  }
}

function handleLogin(username, password) {
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]).trim() === String(username).trim() && String(row[1]).trim() === String(password).trim());
  if (!userRow) return { success: false, message: "Username หรือ Password ไม่ถูกต้อง" };
  return {
    success: true,
    user: { username: userRow[0], password: userRow[1], name: userRow[2], siteId: userRow[3], role: userRow[4], shiftGroup: userRow[5] }
  };
}

function handleClockIn(data) {
  const { username, latitude, longitude, accuracy } = data;
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "ไม่พบข้อมูลพนักงาน" };
  
  const staffId = String(userRow[1]); 
  const name = userRow[2];
  const role = userRow[4];
  const siteId = userRow[3];
  const now = new Date();
  const dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");

  if (role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG);
    const site = siteConfig.find(row => String(row[0]) === siteId);
    if (site) {
      const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000;
      if (distance > (site[4] || 200)) return { success: false, message: "คุณอยู่นอกพื้นที่ปฏิบัติงาน" };
    }
  }
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  logsSheet.appendRow([staffId, name, dateStr, timeStr, latitude, longitude, "", "", "", "", siteId, ""]);
  return { success: true, message: `บันทึกเข้างานสำเร็จ: ${timeStr}` };
}

function handleClockOut(data) {
  const { username, latitude, longitude } = data;
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "ไม่พบข้อมูลพนักงาน" };
  
  const staffId = String(userRow[1]);
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  
  let rowIndex = -1;
  for (let i = logs.length - 1; i >= 1; i--) {
    if (String(logs[i][0]) === staffId && String(logs[i][7]) === "") {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) return { success: false, message: "ไม่พบรายการเข้างานที่ยังไม่ปิดกะ" };
  
  const now = new Date();
  const dateOutStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeOutStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");

  // Robust Calculation for Overnight Shifts
  const inDateVal = logsSheet.getRange(rowIndex, 3).getValue(); // Col C
  const inTimeVal = logsSheet.getRange(rowIndex, 4).getValue(); // Col D
  
  let hoursWorked = "0.00";
  try {
    let inDateTime = new Date(inDateVal);
    // If inTimeVal is string "HH:mm:ss"
    if (typeof inTimeVal === 'string') {
      const t = inTimeVal.split(':');
      inDateTime.setHours(parseInt(t[0]), parseInt(t[1]), parseInt(t[2] || 0));
    } else if (inTimeVal instanceof Date) {
      inDateTime.setHours(inTimeVal.getHours(), inTimeVal.getMinutes(), inTimeVal.getSeconds());
    }
    
    const diffMs = now.getTime() - inDateTime.getTime();
    if (diffMs > 0) {
      hoursWorked = (diffMs / (1000 * 60 * 60)).toFixed(2);
    }
  } catch (e) {
    console.error("Calculation error", e);
  }

  logsSheet.getRange(rowIndex, 7).setValue(dateOutStr);
  logsSheet.getRange(rowIndex, 8).setValue(timeOutStr);
  logsSheet.getRange(rowIndex, 9).setValue(latitude);
  logsSheet.getRange(rowIndex, 10).setValue(longitude);
  logsSheet.getRange(rowIndex, 12).setValue(hoursWorked);
  
  return { success: true, message: `บันทึกออกงานสำเร็จ ชั่วโมงทำงาน: ${hoursWorked}` };
}

function getSheetData(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return sheet ? sheet.getDataRange().getValues().slice(1) : [];
}

function sendJSON(content) {
  return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON);
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI / 180;
  const dLon = (lon2-lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
