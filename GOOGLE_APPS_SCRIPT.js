/**
 * GEO CLOCK AI - BACKEND (LINE ID Version)
 * 
 * COLUMN MAPPING UPDATE:
 * Col A (0): System ID (or Old User)
 * Col B (1): Username (Display Name) -> Used for Clocking Log
 * Col C (2): Name
 * Col D (3): Site_ID
 * Col E (4): Role_Type
 * Col F (5): LINE_ID -> Used for Login Lookup
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";

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
      // For Login, we treat the 'username' param as the LINE ID input
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

function handleLogin(lineIdInput, password) {
  const db = getSheetData(SHEET_EMPLOY_DB); 
  
  if (db.length === 0) {
    return { success: false, message: "Database is empty." };
  }

  // LOGIN LOGIC: Search in Column F (Index 5) for the LINE ID
  const userRow = db.find(row => String(row[5]).trim() === String(lineIdInput).trim());
  
  if (!userRow) {
    return { success: false, message: "LINE ID not registered in database." };
  }
  
  // Optional: Check Password if needed (Assuming password is still in Col A or not checked?)
  // If you need password check, uncomment and adjust index:
  // if (String(userRow[???]) !== String(password)) return { ... }

  return {
    success: true,
    user: {
      username: userRow[1], // Column B: Display Username
      name: userRow[2],     // Column C: Name
      siteId: userRow[3],   // Column D: Site ID
      role: userRow[4],     // Column E: Role
      lineId: userRow[5],   // Column F: LINE ID
      shiftGroup: ""        // Removed or Map to another column if needed
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
  // LOOKUP LOGIC: Find user by Column B (Username) as this is what the app uses after login
  const userRow = db.find(row => String(row[1]) === String(username));
  
  if (!userRow) return { success: false, message: "User not found" };
  
  const user = {
    username: userRow[1], // Col B
    name: userRow[2],
    siteId: userRow[3],
    role: userRow[4]
  };
  
  const todayStr = getThaiDateString(new Date());
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  logs.shift(); // Remove Header
  
  // Check Duplicate
  const existingLog = logs.find(row => 
    getThaiDateString(row[0]) === todayStr && String(row[1]) === user.username
  );
  
  if (existingLog && existingLog[3] !== "") { 
    return { success: false, message: "Already clocked in today." };
  }

  // --- DISTANCE CHECK ---
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
  
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss");
  
  logsSheet.appendRow([
    todayStr, 
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
    return { success: false, message: `GPS signal too weak.` };
  }
  
  const db = getSheetData(SHEET_EMPLOY_DB);
  // LOOKUP LOGIC: Find user by Column B
  const userRow = db.find(row => String(row[1]) === String(username));
  if (!userRow) return { success: false, message: "User not found" };
  
  const user = { username: userRow[1], role: userRow[4], siteId: userRow[3] };
  
  const todayStr = getThaiDateString(new Date());
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  logs.shift(); 
  
  let rowIndex = -1;
  for (let i = 0; i < logs.length; i++) {
    if (getThaiDateString(logs[i][0]) === todayStr && String(logs[i][1]) === user.username) {
      rowIndex = i + 2; 
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, message: "Please Clock In first." };
  }
  
  const outTimeCol = 7; 
  if (logsSheet.getRange(rowIndex, outTimeCol).getValue() !== "") {
    return { success: false, message: "Already clocked out today." };
  }
  
  // --- DISTANCE CHECK ---
  if (user.role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG);
    const site = siteConfig.find(row => String(row[0]) === user.siteId);
    
    if (!site) return { success: false, message: "Site configuration not found." };
    
    const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000;
    const radius = site[4] || 200; 
    
    if (distance > radius) {
       return { success: false, message: `Cannot Clock Out. You are ${Math.round(distance)}m away from site.` };
    }
  }
  
  const timestamp = new Date();
  const timeStr = Utilities.formatDate(timestamp, TIMEZONE, "HH:mm:ss");
  
  // --- Working Hours ---
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
  try {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
  } catch (e) {
    return "";
  }
}

function parseTime(timeVal) {
  if (!timeVal) return null;
  let date = new Date();
  if (timeVal instanceof Date) {
    date = new Date(timeVal.getTime());
  } else if (typeof timeVal === 'string') {
    const parts = timeVal.split(':');
    if (parts.length < 2) return null;
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
  
  // Updated headers hint to match logic
  createIfMissing(SHEET_EMPLOY_DB, ["System_ID", "Username_Display", "Name", "Site_ID", "Role_Type", "LINE_ID"]);
  createIfMissing(SHEET_LOGS, ["Date", "Username", "Name", "Clock_In_Time", "Clock_In_Lat", "Clock_In_Lng", "Clock_Out_Time", "Clock_Out_Lat", "Clock_Out_Lng", "Site_ID", "Working_Hours"]);
  createIfMissing(SHEET_SITE_CONFIG, ["Site_ID", "Site_Name", "Latitude", "Longitude", "Radius_Allowed"]);
}