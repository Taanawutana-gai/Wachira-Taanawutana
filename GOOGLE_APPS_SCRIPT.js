
/**
 * GEO CLOCK AI - BACKEND (With OT Approval System & Geofencing)
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

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; 
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
    radius: parseFloat(site[4]) || 200 
  };
}

function getOTRequests(staffId, role, siteId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_OT_REQUESTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_OT_REQUESTS);
    sheet.appendRow(["Timestamp", "Request_ID", "Staff_ID", "Name", "Site_ID", "Reason", "OT_Start", "OT_End", "Status", "Approver"]);
  }
  const data = sheet.getDataRange().getValues();
  data.shift(); 
  
  return data
    .filter(row => {
      if (role === 'Supervisor') {
        return String(row[4]) === String(siteId) || row[8] === "Pending";
      }
      return String(row[2]) === String(staffId);
    })
    .map(row => ({
      timestamp: row[0] instanceof Date ? Utilities.formatDate(row[0], TIMEZONE, "yyyy-MM-dd HH:mm:ss") : row[0],
      id: row[1],
      staffId: row[2],
      name: row[3],
      siteId: row[4],
      reason: row[5],
      startTime: row[6] instanceof Date ? Utilities.formatDate(row[6], TIMEZONE, "yyyy-MM-dd HH:mm") : row[6],
      endTime: row[7] instanceof Date ? Utilities.formatDate(row[7], TIMEZONE, "yyyy-MM-dd HH:mm") : row[7],
      status: row[8],
      approverName: row[9]
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
  const { staffId, name, siteId, startTime, endTime, reason, role } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_OT_REQUESTS);
  const requestId = "OT-" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss") + "-" + staffId;
  
  sheet.appendRow([new Date(), requestId, staffId, name, siteId, reason, startTime, endTime, "Pending", ""]);
  
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
    if (String(rows[i][1]) === String(requestId)) {
      sheet.getRange(i + 1, 9).setValue(status);
      sheet.getRange(i + 1, 10).setValue(approverName);
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
      timeIn: row[3] instanceof Date ? Utilities.formatDate(row[3], TIMEZONE, "HH:mm:ss") : row[3],
      dateOut: row[6] instanceof Date ? Utilities.formatDate(row[6], TIMEZONE, "yyyy-MM-dd") : row[6],
      timeOut: row[7] instanceof Date ? Utilities.formatDate(row[7], TIMEZONE, "HH:mm:ss") : row[7],
      workingHours: row[11] || "0 นาที"
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
  const userRole = userRow[4]; // แก้ไขจาก const userRole = userRole = userRow[4];

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

  const locationCheck = validateLocation(userRole, siteId, latitude, longitude);
  if (!locationCheck.allowed) return { success: false, message: locationCheck.message };

  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const logs = logsSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = logs.length - 1; i >= 1; i--) {
    if (String(logs[i][0]) === staffId && (logs[i][7] === "" || logs[i][7] == null)) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "ไม่พบการลงเวลาเข้างาน" };
  
  const now = new Date();
  const dateOutStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeOutStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");
  
  let workingHoursResult = "0 นาที";
  try {
    const rowData = logs[rowIndex-1];
    const dateInVal = rowData[2];
    const timeInVal = rowData[3];
    
    const dateInStr = dateInVal instanceof Date ? Utilities.formatDate(dateInVal, TIMEZONE, "yyyy-MM-dd") : String(dateInVal);
    const timeInStr = timeInVal instanceof Date ? Utilities.formatDate(timeInVal, TIMEZONE, "HH:mm:ss") : String(timeInVal);
    
    const startTime = new Date(dateInStr.split('T')[0] + "T" + timeInStr);
    const diffMs = now.getTime() - startTime.getTime();
    
    if (!isNaN(diffMs)) {
      const totalMinutes = Math.round(diffMs / (1000 * 60));
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      workingHoursResult = h > 0 ? h + " ชม. " + m + " นาที" : m + " นาที";
    }
  } catch (e) {
    workingHoursResult = "0 นาที";
  }

  logsSheet.getRange(rowIndex, 7).setValue(dateOutStr);
  logsSheet.getRange(rowIndex, 8).setValue(timeOutStr);
  logsSheet.getRange(rowIndex, 9).setValue(latitude);
  logsSheet.getRange(rowIndex, 10).setValue(longitude);
  logsSheet.getRange(rowIndex, 12).setValue(workingHoursResult);

  return { 
    success: true, 
    message: `บันทึกออกงานสำเร็จ (${workingHoursResult})`,
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
