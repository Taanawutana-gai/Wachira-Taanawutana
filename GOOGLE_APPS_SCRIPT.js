/**
 * GEO CLOCK AI - BACKEND (Username/Password Version)
 * 
 * SETUP:
 * 1. Create Sheets: "Employ_DB", "Logs", "Site_Config", "Shift_Table"
 * 2. Deploy as Web App -> Execute as: Me -> Who has access: Anyone
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";
const SHEET_SHIFT_TABLE = "Shift_Table"; 

const TIMEZONE = "Asia/Bangkok"; // Force Thai Timezone

// Handle GET requests to verify the script is running
function doGet(e) {
  return ContentService.createTextOutput("GeoClock AI Backend is Running. Use POST requests to interact.");
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
  
  if (db.length === 0) {
    return { success: false, message: "Database is empty. Please add users." };
  }

  const userRow = db.find(row => String(row[0]).trim() === String(username).trim() && String(row[1]).trim() === String(password).trim());
  
  if (!userRow) {
    return { success: false, message: "Invalid username or password" };
  }
  
  return {
    success: true,
    user: {
      username: userRow[0],
      name: userRow[2],
      siteId: userRow[3],
      role: userRow[4],
      shiftGroup: userRow[5]
    }
  };
}

function handleClockIn(data) {
  const { username, latitude, longitude, accuracy } = data;
  
  // Spec Section 7: GPS Accuracy Check
  if (accuracy && accuracy > 200) {
    return { success: false, message: `GPS signal too weak (Accuracy: ${Math.round(accuracy)}m). Please move outdoors.` };
  }

  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  
  if (!userRow) return { success: false, message: "User not found" };
  
  const user = {
    username: userRow[0],
    name: userRow[2],
    siteId: userRow[3],
    role: userRow[4]
  };
  
  // Fix: Use Thai Timezone for Date String
  const todayStr = getThaiDateString(new Date());
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  logs.shift(); // Remove Header
  
  // Check Duplicate using Thai Date
  const existingLog = logs.find(row => 
    getThaiDateString(row[0]) === todayStr && String(row[1]) === user.username
  );
  
  if (existingLog && existingLog[3] !== "") { 
    return { success: false, message: "Already clocked in today." };
  }

  if (user.role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG);
    const site = siteConfig.find(row => String(row[0]) === user.siteId);
    
    if (!site) return { success: false, message: "Site configuration not found." };
    
    const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000;
    const radius = site[4] || 200;
    
    if (distance > radius) {
      return { success: false, message: `Out of range! You are ${Math.round(distance)}m away from site (Max ${radius}m).` };
    }
  }
  
  // Time in HH:mm:ss format (Thai Time)
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss");
  
  logsSheet.appendRow([
    todayStr, // Store YYYY-MM-DD string to avoid timezone confusion in sheet cells
    user.username,
    user.name,
    timestamp,
    latitude,
    longitude,
    "", 
    "", 
    "", 
    user.siteId,
    "" 
  ]);
  
  return { success: true, message: `Clock In Successful at ${timestamp}` };
}

function handleClockOut(data) {
  const { username, latitude, longitude, accuracy } = data;

  if (accuracy && accuracy > 200) {
    return { success: false, message: `GPS signal too weak (Accuracy: ${Math.round(accuracy)}m). Please move outdoors.` };
  }
  
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "User not found" };
  
  const user = { username: userRow[0], role: userRow[4], siteId: userRow[3] };
  
  // Fix: Use Thai Timezone
  const todayStr = getThaiDateString(new Date());
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  logs.shift(); // Remove Header
  
  let rowIndex = -1;
  for (let i = 0; i < logs.length; i++) {
    // Compare dates using strict Thai Timezone formatting
    if (getThaiDateString(logs[i][0]) === todayStr && String(logs[i][1]) === user.username) {
      rowIndex = i + 2; 
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, message: "Please Clock In first." };
  }
  
  const outTimeCol = 7; // Col G
  if (logsSheet.getRange(rowIndex, outTimeCol).getValue() !== "") {
    return { success: false, message: "Already clocked out today." };
  }
  
  if (user.role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG);
    const site = siteConfig.find(row => String(row[0]) === user.siteId);
    if (site) {
       const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000;
       const radius = site[4] || 200;
       if (distance > radius) {
         return { success: false, message: `Cannot Clock Out. You are ${Math.round(distance)}m away from site.` };
       }
    }
  }
  
  const timestamp = new Date();
  const timeStr = Utilities.formatDate(timestamp, TIMEZONE, "HH:mm:ss");
  
  const inTimeVal = logsSheet.getRange(rowIndex, 4).getValue(); // Col D is InTime
  let hoursWorked = 0;
  
  if (inTimeVal) {
    const d1 = parseTime(inTimeVal);
    const d2 = parseTime(timeStr);
    if (d1 && d2) {
      const diffMs = d2 - d1;
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

// Helper: Get Date String in YYYY-MM-DD (Thai Time)
function getThaiDateString(dateObj) {
  if (!dateObj) return "";
  try {
    // Handles both Date object and date string from sheet
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
  } catch (e) {
    return "";
  }
}

function parseTime(timeVal) {
  if (!timeVal) return null;
  
  // If Sheets returns a Date object directly (sometimes happens with time formatting)
  if (timeVal instanceof Date) {
    // If it's a full date object, we need to normalize it to today to calculate difference
    const now = new Date();
    timeVal.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    return timeVal;
  }
  
  if (typeof timeVal === 'string') {
    const d = new Date();
    const parts = timeVal.split(':');
    if (parts.length < 2) return null;
    d.setHours(parts[0], parts[1], parts[2] || 0);
    return d;
  }
  
  return null;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; 
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; 
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const createIfMissing = (name, headers) => {
    if (!ss.getSheetByName(name)) {
      const s = ss.insertSheet(name);
      s.appendRow(headers);
      s.setFrozenRows(1);
    }
  }
  
  createIfMissing(SHEET_EMPLOY_DB, ["Username", "Password", "Name", "Site_ID", "Role_Type", "Shift_Group"]);
  createIfMissing(SHEET_LOGS, ["Date", "Username", "Name", "Clock_In_Time", "Clock_In_Lat", "Clock_In_Lng", "Clock_Out_Time", "Clock_Out_Lat", "Clock_Out_Lng", "Site_ID", "Working_Hours"]);
  createIfMissing(SHEET_SITE_CONFIG, ["Site_ID", "Site_Name", "Latitude", "Longitude", "Radius_Allowed"]);
  createIfMissing(SHEET_SHIFT_TABLE, ["Shift_Group", "Shift_Name", "Start_Time", "End_Time", "Late_Time"]);
}