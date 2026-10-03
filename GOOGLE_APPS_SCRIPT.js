
/**
 * TIME CLOCK IN-OUT - BACKEND (Geofencing, ปรับให้รองรับคนลงเวลาพร้อมกันจำนวนมาก)
 *
 * การติดตั้ง (ทำครั้งเดียว):
 * 1. Project Settings (รูปเฟือง) → Time zone = (GMT+07:00) Bangkok
 * 2. เลือกฟังก์ชัน setupTriggers ในแถบด้านบน แล้วกด Run (อนุญาตสิทธิ์เมื่อถูกถาม)
 * 3. Deploy → Manage deployments → แก้ไข deployment เดิม → Version: New version
 *    (อย่ากด New deployment เพราะ URL จะเปลี่ยน)
 *
 * หลักการที่ทำให้เร็วขึ้น:
 * - Employ_DB และ Site_Config เก็บใน Cache 10 นาที ไม่อ่านชีตทุกครั้ง
 * - Clock In/Out อ่านเฉพาะ RECENT_ROWS (500) แถวท้ายของ Logs ไม่อ่านทั้งชีต
 * - ประวัติของแต่ละคน (สำหรับสถิติ) เก็บใน Cache และอุ่นไว้ล่วงหน้าทุก 4 ชม.
 * - ไม่ใช้ LockService: appendRow เป็นคำสั่งเดียวจบ และ Clock Out เขียนเฉพาะแถวของตัวเอง
 *
 * ถ้าแก้ไขชีต Employ_DB / Site_Config แล้วต้องการให้มีผลทันที ให้ Run ฟังก์ชัน clearCache
 * (ถ้าไม่ทำ จะมีผลเองภายใน 10 นาที)
 */

const SHEET_EMPLOY_DB = "Employ_DB";
const SHEET_LOGS = "Logs";
const SHEET_SITE_CONFIG = "Site_Config";
const TIMEZONE = "Asia/Bangkok";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;   // Clock Out ปิดได้เฉพาะรายการที่เข้างานไม่เกิน 16 ชม.
const DUPLICATE_MS = 2 * 60 * 1000;         // กดซ้ำ/ลองใหม่ภายใน 2 นาที ถือว่าบันทึกไปแล้ว
const RECENT_ROWS = 500;                    // จำนวนแถวท้ายของ Logs ที่อ่านตอน Clock In/Out (ต้องครอบคลุมอย่างน้อย 16 ชม.)
const LOGS_PER_USER = 20;

const CACHE_CONFIG_TTL = 600;    // 10 นาที
const CACHE_LOGS_TTL = 21600;    // 6 ชม. (สูงสุดที่ CacheService รองรับ)

// คอลัมน์ในชีต Logs (เริ่มที่ 0)
const COL = { STAFF: 0, NAME: 1, DATE_IN: 2, TIME_IN: 3, DATE_OUT: 6, TIME_OUT: 7, SITE_IN: 10, HOURS: 11 };
const LOG_COLS = 13;

function doGet(e) {
  return ContentService.createTextOutput("Time Clock IN-OUT Backend is Running.");
}

function doPost(e) {
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

/* ===================== Cache: พนักงาน / ไซต์ ===================== */

// ใส่ค่าใน Cache โดยไม่ให้ error (เช่น ค่าใหญ่เกิน 100KB) ทำให้การลงเวลาล้มเหลว
function cachePut(key, value, ttl) {
  try {
    CacheService.getScriptCache().put(key, value, ttl);
  } catch (e) {
    console.warn("cache put failed: " + key + " " + e);
  }
}

function getEmployees(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const hit = cache.get("employees");
    if (hit) return JSON.parse(hit);
  }
  const map = {};
  getSheetData(SHEET_EMPLOY_DB).forEach(row => {
    const username = String(row[0]).trim();
    if (!username) return;
    map[username] = {
      username: username,
      staffId: String(row[1]).trim(),
      name: String(row[2]),
      siteId: String(row[3]),
      role: String(row[4]),
      position: String(row[5])
    };
  });
  cachePut("employees", JSON.stringify(map), CACHE_CONFIG_TTL);
  return map;
}

function getSites(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const hit = cache.get("sites");
    if (hit) return JSON.parse(hit);
  }
  const sites = getSheetData(SHEET_SITE_CONFIG)
    .filter(row => String(row[0]).trim() !== "")
    .map(row => ({
      id: String(row[0]),
      name: String(row[1]) || String(row[0]),
      lat: parseFloat(row[2]),
      lng: parseFloat(row[3]),
      radius: parseFloat(row[4]) || 100
    }));
  cachePut("sites", JSON.stringify(sites), CACHE_CONFIG_TTL);
  return sites;
}

/* ===================== Cache: ประวัติลงเวลารายคน ===================== */

function rowToLog(row) {
  return {
    staffId: row[COL.STAFF],
    name: row[COL.NAME],
    dateIn: row[COL.DATE_IN] instanceof Date ? Utilities.formatDate(row[COL.DATE_IN], TIMEZONE, "yyyy-MM-dd") : row[COL.DATE_IN],
    timeIn: row[COL.TIME_IN] instanceof Date ? Utilities.formatDate(row[COL.TIME_IN], TIMEZONE, "HH:mm:ss") : row[COL.TIME_IN],
    dateOut: row[COL.DATE_OUT] instanceof Date ? Utilities.formatDate(row[COL.DATE_OUT], TIMEZONE, "yyyy-MM-dd") : row[COL.DATE_OUT],
    timeOut: row[COL.TIME_OUT] instanceof Date ? Utilities.formatDate(row[COL.TIME_OUT], TIMEZONE, "HH:mm:ss") : row[COL.TIME_OUT],
    workingHours: row[COL.HOURS] || "0 นาที"
  };
}

function logsCacheKey(staffId) {
  return "logs_" + staffId;
}

// ประวัติของพนักงานหนึ่งคน: ใช้ Cache ก่อน ถ้าไม่มีค่อยอ่านชีต (เกิดไม่บ่อยเพราะมี warmCache)
function getUserLogs(staffId) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(logsCacheKey(staffId));
  if (hit) return JSON.parse(hit);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.HOURS + 1).getValues();
  const logs = data
    .filter(row => String(row[COL.STAFF]) === String(staffId))
    .slice(-LOGS_PER_USER)
    .map(rowToLog);
  cachePut(logsCacheKey(staffId), JSON.stringify(logs), CACHE_LOGS_TTL);
  return logs;
}

// อัปเดต Cache ประวัติหลัง Clock In/Out (ถ้า Cache ไม่มีอยู่ก็ข้ามไป ครั้งหน้าจะอ่านจากชีตเอง)
function updateCachedLogs(staffId, updater) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(logsCacheKey(staffId));
  if (!hit) return undefined;
  const logs = updater(JSON.parse(hit)).slice(-LOGS_PER_USER);
  cachePut(logsCacheKey(staffId), JSON.stringify(logs), CACHE_LOGS_TTL);
  return logs;
}

// อ่าน Logs ครั้งเดียวแล้วเติม Cache ให้ทุกคน (รันอัตโนมัติทุก 4 ชม. ผ่าน setupTriggers)
function warmCache() {
  getEmployees(true);
  getSites(true);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.HOURS + 1).getValues();

  const byStaff = {};
  data.forEach(row => {
    const id = String(row[COL.STAFF]);
    if (!id) return;
    (byStaff[id] = byStaff[id] || []).push(row);
  });

  const entries = {};
  Object.keys(byStaff).forEach(id => {
    entries[logsCacheKey(id)] = JSON.stringify(byStaff[id].slice(-LOGS_PER_USER).map(rowToLog));
  });
  // putAll รับได้จำกัดต่อครั้ง จึงแบ่งเป็นชุดละ 100 คีย์
  const keys = Object.keys(entries);
  const cache = CacheService.getScriptCache();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = {};
    keys.slice(i, i + 100).forEach(k => chunk[k] = entries[k]);
    cache.putAll(chunk, CACHE_LOGS_TTL);
  }
}

function clearCache() {
  CacheService.getScriptCache().removeAll(["employees", "sites"]);
  warmCache();
}

function setupTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "warmCache")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("warmCache").timeBased().everyHours(4).create();
  warmCache();
}

/* ===================== อ่านเฉพาะแถวท้ายของ Logs ===================== */

function getRecentLogRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { startRow: 2, rows: [] };
  const startRow = Math.max(2, lastRow - RECENT_ROWS + 1);
  return { startRow: startRow, rows: sheet.getRange(startRow, 1, lastRow - startRow + 1, LOG_COLS).getValues() };
}

// รวมวันที่ + เวลาจากชีตเป็น Date ตามเวลาไทยเสมอ ไม่ขึ้นกับ Time zone ของโปรเจกต์
function toBangkokDate(dateVal, timeVal) {
  const d = dateVal instanceof Date ? Utilities.formatDate(dateVal, TIMEZONE, "yyyy-MM-dd") : String(dateVal).split('T')[0];
  const t = timeVal instanceof Date ? Utilities.formatDate(timeVal, TIMEZONE, "HH:mm:ss") : String(timeVal);
  return new Date(d + "T" + t + "+07:00");
}

function isEmpty(v) {
  return v === "" || v == null;
}

/* ===================== ตรวจพิกัด ===================== */

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

function validateLocation(role, siteId, userLat, userLng) {
  if (role !== 'Fixed' && role !== 'Supervisor') return { allowed: true };

  const config = getSites().find(s => String(s.id) === String(siteId));
  if (!config) return { allowed: false, message: "ไม่พบการตั้งค่าพิกัดสำหรับไซต์งานนี้" };

  const radius = role === 'Supervisor' ? 100 : config.radius;
  const distance = calculateDistance(userLat, userLng, config.lat, config.lng);
  if (distance > radius) {
    return {
      allowed: false,
      message: `อยู่นอกพื้นที่ปฏิบัติงาน (${distance.toFixed(0)} ม.) รัศมีที่อนุญาตคือ ${radius} ม.`
    };
  }

  return { allowed: true };
}

/* ===================== Actions ===================== */

function handleLogin(username, password) {
  const emp = getEmployees()[String(username).trim()];
  if (!emp || emp.staffId !== String(password).trim()) {
    return { success: false, message: "Username หรือ Password ไม่ถูกต้อง" };
  }

  return {
    success: true,
    user: { username: emp.username, name: emp.name, siteId: emp.siteId, role: emp.role, position: emp.position },
    logs: getUserLogs(emp.staffId),
    sites: emp.role === 'Supervisor' ? getSites().map(s => ({ id: s.id, name: s.name })) : []
  };
}

function prepareClockAction(data) {
  const emp = getEmployees()[String(data.username).trim()];
  if (!emp) return { error: "ไม่พบข้อมูลพนักงาน" };
  const siteId = (emp.role === 'Supervisor' && data.selectedSiteId) ? data.selectedSiteId : emp.siteId;
  const locationCheck = validateLocation(emp.role, siteId, data.latitude, data.longitude);
  if (!locationCheck.allowed) return { error: locationCheck.message };
  return { emp: emp, siteId: siteId };
}

function handleClockIn(data) {
  const prep = prepareClockAction(data);
  if (prep.error) return { success: false, message: prep.error };
  const emp = prep.emp;

  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const recent = getRecentLogRows(logsSheet);
  const now = new Date();

  // รายการล่าสุดของพนักงานคนนี้
  for (let i = recent.rows.length - 1; i >= 0; i--) {
    const row = recent.rows[i];
    if (String(row[COL.STAFF]) !== emp.staffId) continue;
    const lastClockIn = toBangkokDate(row[COL.DATE_IN], row[COL.TIME_IN]);
    if (!isNaN(lastClockIn.getTime())) {
      const diff = now.getTime() - lastClockIn.getTime();
      // กดซ้ำหรือแอปลองส่งใหม่: ถือว่าสำเร็จ ไม่สร้างแถวซ้ำ
      if (diff >= 0 && diff < DUPLICATE_MS) {
        return { success: true, message: `บันทึกเข้างานแล้ว: ${Utilities.formatDate(lastClockIn, TIMEZONE, "HH:mm:ss")}` };
      }
      // ตรวจสอบการบันทึกซ้ำภายใน 6 ชั่วโมง (เฉพาะพนักงานที่ไม่ใช่ Supervisor)
      if (emp.role !== 'Supervisor' && diff < SIX_HOURS_MS) {
        const remainingMs = SIX_HOURS_MS - diff;
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return {
          success: false,
          message: `คุณได้บันทึกเข้างานไปแล้ว กรุณารออีก ${remainingHours} ชม. ${remainingMins} นาที (ต้องห่างกันครบ 6 ชม.)`
        };
      }
    }
    break;
  }

  const dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");
  logsSheet.appendRow([emp.staffId, emp.name, dateStr, timeStr, data.latitude, data.longitude, "", "", "", "", prep.siteId, ""]);

  const logs = updateCachedLogs(emp.staffId, list => list.concat([{
    staffId: emp.staffId, name: emp.name, dateIn: dateStr, timeIn: timeStr, dateOut: "", timeOut: "", workingHours: "0 นาที"
  }]));

  return {
    success: true,
    message: `บันทึกเข้างานสำเร็จ: ${timeStr}`,
    logs: logs
  };
}

function handleClockOut(data) {
  const prep = prepareClockAction(data);
  if (prep.error) return { success: false, message: prep.error };
  const emp = prep.emp;

  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const recent = getRecentLogRows(logsSheet);
  const now = new Date();

  let target = -1;
  let startTime = null;
  let isLatest = true;
  for (let i = recent.rows.length - 1; i >= 0; i--) {
    const row = recent.rows[i];
    if (String(row[COL.STAFF]) !== emp.staffId) continue;

    // กดซ้ำหรือแอปลองส่งใหม่: รายการล่าสุดเพิ่งบันทึกออกไปภายใน 2 นาที
    if (isLatest && !isEmpty(row[COL.TIME_OUT])) {
      const out = toBangkokDate(row[COL.DATE_OUT], row[COL.TIME_OUT]);
      const diff = now.getTime() - out.getTime();
      if (!isNaN(diff) && diff >= 0 && diff < DUPLICATE_MS) {
        return { success: true, message: `บันทึกออกงานแล้ว (${row[COL.HOURS]})` };
      }
    }
    isLatest = false;

    // หารายการล่าสุดที่ยังไม่มีเวลาออก และต้องเข้างานไม่เกิน 16 ชม.
    // (รายการเก่าที่ลืมกดออกจะไม่ถูกปิดอัตโนมัติ ให้หัวหน้าแก้ในชีตเอง)
    if (isEmpty(row[COL.TIME_OUT])) {
      const start = toBangkokDate(row[COL.DATE_IN], row[COL.TIME_IN]);
      if (!isNaN(start.getTime()) && now.getTime() - start.getTime() <= MAX_SHIFT_MS) {
        target = i;
        startTime = start;
      }
      break;
    }
  }
  if (target === -1) return { success: false, message: "ไม่พบการลงเวลาเข้างานภายใน 16 ชม. ที่ผ่านมา กรุณาติดต่อหัวหน้างาน" };

  const rowIndex = recent.startRow + target;
  const dateOutStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeOutStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");

  const totalMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const workingHoursResult = h > 0 ? h + " ชม. " + m + " นาที" : m + " นาที";

  // เขียนคอลัมน์ G–M ในคำสั่งเดียว (คอลัมน์ K = ไซต์ขาเข้า ใช้ค่าเดิม)
  const siteIn = recent.rows[target][COL.SITE_IN];
  logsSheet.getRange(rowIndex, 7, 1, 7).setValues([[dateOutStr, timeOutStr, data.latitude, data.longitude, siteIn, workingHoursResult, prep.siteId]]);

  const dateInStr = Utilities.formatDate(startTime, TIMEZONE, "yyyy-MM-dd");
  const timeInStr = Utilities.formatDate(startTime, TIMEZONE, "HH:mm:ss");
  const logs = updateCachedLogs(emp.staffId, list => list.map(l =>
    (l.dateIn === dateInStr && l.timeIn === timeInStr && !l.timeOut)
      ? Object.assign({}, l, { dateOut: dateOutStr, timeOut: timeOutStr, workingHours: workingHoursResult })
      : l
  ));

  return {
    success: true,
    message: `บันทึกออกงานสำเร็จ (${workingHoursResult})`,
    logs: logs
  };
}

/* ===================== Utilities ===================== */

function getSheetData(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return sheet ? sheet.getDataRange().getValues().slice(1) : [];
}

function sendJSON(content) {
  return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON);
}
