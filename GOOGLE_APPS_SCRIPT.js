
/**
 * GEO CLOCK AI - BACKEND (With OT Approval System & Geofencing)
 * 
 * LOGS STRUCTURE: A: Staff_ID, ..., L: Working_Hours
 * OT_REQUESTS STRUCTURE: A: Request_ID, B: Staff_ID, C: Name, D: Site_ID, E: Date, F: Reason, G: Hours, H: Status, I: Approver, J: Timestamp
 * EMPLOY_DB STRUCTURE: A: Username, B: Password/Staff_ID, C: Name, D: Site_ID, E: Role, F: Position
 * SITE_CONFIG STRUCTURE: A: Site_ID, B: Site_Name, C: Lat, D: Lng, E: Radius
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";
const SHEET_OT_REQUESTS = "OT_Requests";
const TIMEZONE = "Asia/Bangkok"; 

function doGet(e) {
  return ContentService.createTextOutput("GeoClock AI Backend is Running.");
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) return sendJSON({ success: false, message: "No data" });
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "LOGIN_USER") return sendJSON(handleLogin(data.username, data.password));
    if (data.action === "CLOCK_IN") return sendJSON(handleClockIn(data));
    if (data.action === "CLOCK_OUT") return sendJSON(handleClockOut(data));
    if (data.action === "REQUEST_OT") return sendJSON(handleRequestOT(data));
    if (data.action === "UPDATE_OT_STATUS") return sendJSON(handleUpdateOTStatus(data));
    
    return sendJSON({ success: false, message: "Invalid Action" });
  } catch (error) {
    return sendJSON({ success: false, message: error.toString() });
  }
}

// ฟังก์ชันคำนวณระยะทาง (Haversine Formula) - คืนค่าเป็นเมตร
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // รัศมีโลกเป็นเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getSiteConfig(siteId) {
  const data = getSheetData(SHEET_SITE_CONFIG);
  const site = data.find(row => String(row[0]) === String(siteId));
  if (!site) return null;
  return {
    lat: parseFloat(site[2]),
    lng: parseFloat(site[3]),
    radius: parseFloat(site[4]) || 200 // ถ้าไม่ระบุ ให้เป็น 200 เมตร
  };
}

function getOTRequests(staffId, role, siteId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_OT_REQUESTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_OT_REQUESTS);
    sheet.appendRow(["Request_ID", "Staff_ID", "Name", "Site_ID", "Date", "Reason", "Hours", "Status", "Approver", "Timestamp"]);
  }
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header
  
  return data
    .filter(row => {
      if (role === 'Supervisor') {
        return String(row[3]) === String(siteId) || row[7] === "Pending";
      }
      return String(row[1]) === String(staffId);
    })
    .map(row => ({
      id: row[0],
      staffId: row[1],
      name: row[2],
      siteId: row[3],
      date: row[4] instanceof Date ? Utilities.formatDate(row[4], TIMEZONE, "yyyy-MM-dd") : row[4],
      reason: row[5],
      hours: row[6],
      status: row[7],
      approverName: row[8],
      timestamp: row[9]
    }))
    .reverse();
}

function handleLogin(username, password) {
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]).trim() === String(username).trim() && String(row[1]).trim() === String(password).trim());
  
  if (!userRow) return { success: false, message: "Username หรือ Password ไม่ถูกต้อง" };
  
  const staffId = userRow[1];
  const userObj = { 
    username: userRow[0], 
    password: userRow[1], 
    name: userRow[2], 
    siteId: userRow[3], 
    role: userRow[4], 
    position: userRow[5] 
  };
  
  return {
    success: true,
    user: userObj,
    logs: getUserLogs(staffId),
    otRequests: getOTRequests(staffId, userObj.role, userObj.siteId)
  };
}

function handleRequestOT(data) {
  const { staffId, name, siteId, date, reason, hours, role } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_OT_REQUESTS);
  const requestId = "OT-" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss") + "-" + staffId;
  
  sheet.appendRow([requestId, staffId, name, siteId, date, reason, hours, "Pending", "", new Date()]);
  
  return { 
    success: true, 
    message: "ส่งคำขอ OT เรียบร้อยแล้ว",
    otRequests: getOTRequests(staffId, role, siteId)
  };
}

function handleUpdateOTStatus(data) {
  const { requestId, status, approverName, staffId, role, siteId } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_OT_REQUESTS);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(requestId)) {
      sheet.getRange(i + 1, 8).setValue(status);
      sheet.getRange(i + 1, 9).setValue(approverName);
      break;
    }
  }
  
  return { 
    success: true, 
    message: `ดำเนินการ ${status} สำเร็จ`,
    otRequests: getOTRequests(staffId, role, siteId)
  };
}

function getUserLogs(staffId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift(); 
  return data
    .filter(row => String(row[0]) === String(staffId))
    .slice(-20)
    .map(row => ({
      staffId: row[0],
      name: row[1],
      dateIn: row[2] instanceof Date ? Utilities.formatDate(row[2], TIMEZONE, "yyyy-MM-dd") : row[2],
      timeIn: row[3],
      dateOut: row[6],
      timeOut: row[7],
      workingHours: row[11] || 0
    }));
}

function validateLocation(role, siteId, userLat, userLng) {
  if (role !== 'Fixed') return { allowed: true };
  
  const config = getSiteConfig(siteId);
  if (!config) return { allowed: false, message: "ไม่พบการตั้งค่าพิกัดสำหรับไซต์งานนี้" };
  
  const distance = calculateDistance(userLat, userLng, config.lat, config.lng);
  if (distance > config.radius) {
    return { 
      allowed: false, 
      message: `อยู่นอกพื้นที่ปฏิบัติงาน (${distance.toFixed(0)} ม.) รัศมีที่อนุญาตคือ ${config.radius} ม.` 
    };
  }
  
  return { allowed: true };
}

function handleClockIn(data) {
  const { username, latitude, longitude } = data;
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "ไม่พบข้อมูลพนักงาน" };
  
  const staffId = String(userRow[1]); 
  const siteId = userRow[3];
  const userRole = userRow[4];

  // ตรวจสอบพิกัดเฉพาะกลุ่ม Fixed
  const locationCheck = validateLocation(userRole, siteId, latitude, longitude);
  if (!locationCheck.allowed) return { success: false, message: locationCheck.message };
  
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const now = new Date();
  const dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");
  logsSheet.appendRow([staffId, userRow[2], dateStr, timeStr, latitude, longitude, "", "", "", "", siteId, ""]);
  
  return { 
    success: true, 
    message: `บันทึกเข้างานสำเร็จ: ${timeStr}`,
    logs: getUserLogs(staffId),
    otRequests: getOTRequests(staffId, userRole, siteId)
  };
}

function handleClockOut(data) {
  const { username, latitude, longitude } = data;
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "ไม่พบข้อมูลพนักงาน" };

  const staffId = String(userRow[1]);
  const siteId = userRow[3];
  const userRole = userRow[4];

  // ตรวจสอบพิกัดเฉพาะกลุ่ม Fixed (สำหรับขาออกด้วยเพื่อให้มั่นใจว่ายังอยู่ที่ไซต์)
  const locationCheck = validateLocation(userRole, siteId, latitude, longitude);
  if (!locationCheck.allowed) return { success: false, message: locationCheck.message };

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
  
  let workingHours = "0.00";
  try {
    const dateInVal = logs[rowIndex-1][2];
    const timeInVal = logs[rowIndex-1][3];
    const dateInStr = dateInVal instanceof Date ? Utilities.formatDate(dateInVal, TIMEZONE, "yyyy-MM-dd") : String(dateInVal);
    const startTime = new Date(dateInStr + "T" + String(timeInVal));
    const diffMs = now.getTime() - startTime.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs > 0) workingHours = diffHrs.toFixed(2);
  } catch (e) {
    workingHours = "ERR";
  }

  logsSheet.getRange(rowIndex, 7).setValue(dateOutStr);
  logsSheet.getRange(rowIndex, 8).setValue(timeOutStr);
  logsSheet.getRange(rowIndex, 9).setValue(latitude);
  logsSheet.getRange(rowIndex, 10).setValue(longitude);
  logsSheet.getRange(rowIndex, 12).setValue(workingHours);

  return { 
    success: true, 
    message: `บันทึกออกงานสำเร็จ (${workingHours} ชม.)`,
    logs: getUserLogs(staffId),
    otRequests: getOTRequests(staffId, userRole, siteId)
  };
}

function getSheetData(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return sheet ? sheet.getDataRange().getValues().slice(1) : [];
}

function sendJSON(content) {
  return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON);
}
