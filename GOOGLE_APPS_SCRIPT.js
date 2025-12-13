/**
 * GEO CLOCK AI - BACKEND (LINE ID Version)
 * 
 * SETUP:
 * 1. Create Sheets: "Employ_DB", "Logs", "Site_Config"
 * 2. Deploy as Web App -> Execute as: Me -> Who has access: Anyone
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";

function doPost(e) {
  const output = { success: false, message: "Unknown Error" };
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "CHECK_USER") {
      return sendJSON(handleCheckUser(data.lineUserId));
    }
    
    if (data.action === "CLOCK_IN") {
      return sendJSON(handleClockIn(data));
    }
    
    if (data.action === "CLOCK_OUT") {
      return sendJSON(handleClockOut(data));
    }
    
    output.message = "Invalid Action";
    return sendJSON(output);

  } catch (error) {
    output.message = error.toString();
    return sendJSON(output);
  }
}

function handleCheckUser(lineUserId) {
  const db = getSheetData(SHEET_EMPLOY_DB); // A:LineID, B:Name, C:SiteID, D:Role, E:Shift
  
  const userRow = db.find(row => String(row[0]) === String(lineUserId));
  
  if (!userRow) {
    return { success: false, message: "User not found" };
  }
  
  return {
    success: true,
    user: {
      lineUserId: userRow[0],
      name: userRow[1],
      siteId: userRow[2],
      role: userRow[3],
      shiftGroup: userRow[4]
    }
  };
}

function handleClockIn(data) {
  const { lineUserId, latitude, longitude } = data;
  
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(lineUserId));
  
  if (!userRow) return { success: false, message: "User not found" };
  
  const user = {
    lineUserId: userRow[0],
    name: userRow[1],
    siteId: userRow[2],
    role: userRow[3]
  };
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Check Duplicate
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  // Logs: A:Date, B:LineID, C:Name, D:InTime, ...
  
  const existingLog = logs.find(row => 
    formatDate(row[0]) === today && String(row[1]) === user.lineUserId
  );
  
  if (existingLog && existingLog[3] !== "") { 
    return { success: false, message: "Already clocked in today." };
  }

  // Logic based on Role
  if (user.role === 'Fixed') {
    const siteConfig = getSheetData(SHEET_SITE_CONFIG); // A:ID, B:Name, C:Lat, D:Lng, E:Radius
    const site = siteConfig.find(row => String(row[0]) === user.siteId);
    
    if (!site) return { success: false, message: "Site configuration not found." };
    
    const distance = getDistanceFromLatLonInKm(latitude, longitude, site[2], site[3]) * 1000; // Meters
    const radius = site[4] || 200;
    
    if (distance > radius) {
      return { success: false, message: `Out of range! You are ${Math.round(distance)}m away from site (Max ${radius}m).` };
    }
  }
  
  const timestamp = new Date().toLocaleTimeString('th-TH', { hour12: false });
  
  logsSheet.appendRow([
    today,
    user.lineUserId,
    user.name,
    timestamp,
    latitude,
    longitude,
    "", // Clock Out Time
    "", // Out Lat
    "", // Out Lng
    user.siteId,
    "" // Working Hours
  ]);
  
  return { success: true, message: `Clock In Successful at ${timestamp}` };
}

function handleClockOut(data) {
  const { lineUserId, latitude, longitude } = data;
  
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(lineUserId));
  if (!userRow) return { success: false, message: "User not found" };
  
  const user = { lineUserId: userRow[0], role: userRow[3], siteId: userRow[2] };
  const today = new Date().toISOString().split('T')[0];
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  
  let rowIndex = -1;
  for (let i = 0; i < logs.length; i++) {
    if (formatDate(logs[i][0]) === today && String(logs[i][1]) === user.lineUserId) {
      rowIndex = i + 1; 
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
  const timeStr = timestamp.toLocaleTimeString('th-TH', { hour12: false });
  
  const inTimeVal = logsSheet.getRange(rowIndex, 4).getValue(); 
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

function formatDate(dateObj) {
  if (!dateObj) return "";
  const d = new Date(dateObj);
  return d.toISOString().split('T')[0];
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const d = new Date();
  const [h, m, s] = timeStr.split(':');
  d.setHours(h, m, s || 0);
  return d;
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
  
  createIfMissing(SHEET_EMPLOY_DB, ["Line_User_ID", "Name", "Site_ID", "Role_Type", "Shift_Group"]);
  createIfMissing(SHEET_LOGS, ["Date", "Line_User_ID", "Name", "Clock_In_Time", "Clock_In_Lat", "Clock_In_Lng", "Clock_Out_Time", "Clock_Out_Lat", "Clock_Out_Lng", "Site_ID", "Working_Hours"]);
  createIfMissing(SHEET_SITE_CONFIG, ["Site_ID", "Site_Name", "Latitude", "Longitude", "Radius_Allowed"]);
}