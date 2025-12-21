
/**
 * GEO CLOCK AI - BACKEND (With OT Approval System)
 * 
 * LOGS STRUCTURE: A: Staff_ID, ..., L: Working_Hours
 * OT_REQUESTS STRUCTURE: A: Request_ID, B: Staff_ID, C: Name, D: Site_ID, E: Date, F: Reason, G: Hours, H: Status, I: Approver, J: Timestamp
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
        // หัวหน้าดูของไซด์ตัวเอง หรือทั้งหมดที่ Pending
        return String(row[3]) === String(siteId) || row[7] === "Pending";
      }
      // พนักงานดูของตัวเอง
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
    .reverse(); // ล่าสุดขึ้นก่อน
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
  const { staffId, name, siteId, date, reason, hours } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_OT_REQUESTS);
  const requestId = "OT-" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss") + "-" + staffId;
  
  sheet.appendRow([requestId, staffId, name, siteId, date, reason, hours, "Pending", "", new Date()]);
  
  return { 
    success: true, 
    message: "ส่งคำขอ OT เรียบร้อยแล้ว รอการอนุมัติ",
    otRequests: getOTRequests(staffId, 'Fixed', siteId) // รีเฟรชข้อมูล
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
    message: `ทำรายการ ${status} สำเร็จ`,
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

function handleClockIn(data) {
  const { username, latitude, longitude } = data;
  const db = getSheetData(SHEET_EMPLOY_DB);
  const userRow = db.find(row => String(row[0]) === String(username));
  if (!userRow) return { success: false, message: "ไม่พบข้อมูลพนักงาน" };
  const staffId = String(userRow[1]); 
  const userRole = userRow[4];
  const siteId = userRow[3];
  
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
  const staffId = String(userRow[1]);
  const userRole = userRow[4];
  const siteId = userRow[3];

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
  
  logsSheet.getRange(rowIndex, 7).setValue(dateOutStr);
  logsSheet.getRange(rowIndex, 8).setValue(timeOutStr);
  logsSheet.getRange(rowIndex, 12).setValue("8.00");

  return { 
    success: true, 
    message: `บันทึกออกงานสำเร็จ`,
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
