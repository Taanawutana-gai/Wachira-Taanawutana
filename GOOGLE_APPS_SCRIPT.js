
/**
 * GEO CLOCK AI - BACKEND (Staff ID Logging Version)
 * 
 * SETUP:
 * 1. Create Sheets: "Employ_DB", "Logs", "Site_Config", "Shift_Table"
 * 2. Deploy as Web App -> Execute as: Me -> Who has access: Anyone
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";
const SHEET_SHIFT_TABLE = "Shift_Table"; 

const TIMEZONE = "Asia/Bangkok"; 

function doGet(e) {
  return ContentService.createTextOutput("GeoClock AI Backend is Running. Staff ID logging enabled.");
}

function doPost(e) {
  const output = { success: false, message: "Unknown Error" };
  
  try {
    if (!e.postData || !e.postData.contents) {
      output.message = "No data received";
      return sendJSON(output);
    }

    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "LOGIN_USER") {
      return sendJSON(handleLogin(data.username, data.password));
    }
    
    if (data.action === "CLOCK_IN") {
      return sendJSON(handleClockIn(data));
    }
    
    if (data.action === "CLOCK_OUT") {
      return sendJSON(handleClockOut(data));
    }
    
    output.message = "Invalid Action: " + data.action;
    return sendJSON(output);

  } catch (error) {
    output.message = "Server Exception: " + error.toString();
    return sendJSON(output);
  }
}

function handleLogin(username, password) {
  const db = getSheetData(SHEET_EMPLOY_DB); 
  if (db.length === 0) return { success: false, message: "Database is empty." };

  const userRow = db.find(row => String(row[0]).trim() === String(username).trim() && String(row[1]).trim() === String(password).trim());
  
  if (!userRow) return { success: false, message: "Invalid username or password" };
  
  return {
    success: true,
    user: {
      username: userRow[0], // LINE ID
      password: userRow[1], // Staff ID
      name: userRow[2],
      siteId: userRow[3],
      role: userRow[4],
      shiftGroup: userRow[5]
    }
  };
}

function handleClockIn(data) {
  const { username, latitude, longitude, accuracy } = data;
  
  if (accuracy && accuracy > 200) {
    return { success: false, message: `GPS signal too weak (${Math.round(accuracy)}m).` };
  }

  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "User not found" };
  
  const staffId = String(userRow[1]); // Get Staff ID from Column B
  const name = userRow[2];
  const role = userRow[4];
  const siteId = userRow[3];
  
  const todayStr = getThaiDateString(new Date());

  if (role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG);
    const site = siteConfig.find(row => String(row[0]) === siteId);
    if (!site) return { success: false, message: "Site configuration not found." };
    
    const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000;
    const radius = site[4] || 200;
    
    if (distance > radius) {
      return { success: false, message: `Out of range! Distance: ${Math.round(distance)}m.` };
    }
  }
  
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss");
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  
  logsSheet.appendRow([
    todayStr,
    staffId, // RECORD STAFF ID INSTEAD OF LINE ID
    name,
    timestamp,
    latitude,
    longitude,
    "", // Clock Out Time
    "", // Out Lat
    "", // Out Lng
    siteId,
    "" // Working Hours
  ]);
  
  return { success: true, message: `Clock In Successful at ${timestamp}` };
}

function handleClockOut(data) {
  const { username, latitude, longitude, accuracy } = data;

  if (accuracy && accuracy > 200) {
    return { success: false, message: `GPS signal too weak.` };
  }
  
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "User not found" };
  
  const staffId = String(userRow[1]); // Identify record by Staff ID
  const role = userRow[4];
  const siteId = userRow[3];
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  
  // Search for the latest open session for this STAFF ID
  let rowIndex = -1;
  for (let i = logs.length - 1; i >= 1; i--) {
    if (String(logs[i][1]) === staffId && String(logs[i][6]) === "") {
      rowIndex = i + 1; 
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, message: "No active session found. Please Clock In first." };
  }
  
  if (role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG);
    const site = siteConfig.find(row => String(row[0]) === siteId);
    if (site) {
      const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000;
      const radius = site[4] || 200;
      if (distance > radius) return { success: false, message: "Out of range for Clock Out." };
    }
  }
  
  const timestamp = new Date();
  const timeStr = Utilities.formatDate(timestamp, TIMEZONE, "HH:mm:ss");
  
  // Calculate Hours
  const inTimeVal = logsSheet.getRange(rowIndex, 4).getValue();
  let hoursWorked = "";
  if (inTimeVal) {
    const d1 = parseTime(inTimeVal);
    const d2 = parseTime(timeStr);
    if (d1 && d2) {
      const diffMs = d2.getTime() - d1.getTime();
      hoursWorked = (diffMs / (1000 * 60 * 60)).toFixed(2); 
    }
  }
  
  logsSheet.getRange(rowIndex, 7).setValue(timeStr);
  logsSheet.getRange(rowIndex, 8).setValue(latitude);
  logsSheet.getRange(rowIndex, 9).setValue(longitude);
  logsSheet.getRange(rowIndex, 11).setValue(hoursWorked);
  
  return { success: true, message: `Clock Out Successful. Hours: ${hoursWorked}` };
}

function getSheetData(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift(); 
  return data;
}

function sendJSON(content) {
  return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON);
}

function getThaiDateString(dateObj) {
  if (!dateObj) return "";
  const d = new Date(dateObj);
  return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
}

function parseTime(timeVal) {
  if (!timeVal) return null;
  let date = new Date();
  if (timeVal instanceof Date) {
    date = new Date(timeVal.getTime());
  } else if (typeof timeVal === 'string') {
    const parts = timeVal.split(':');
    date.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || 0, 10), 0);
  } else {
    return null;
  }
  date.setFullYear(1970, 0, 1);
  return date;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; 
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function deg2rad(deg) { return deg * (Math.PI/180); }
