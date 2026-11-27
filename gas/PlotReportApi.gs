/**
 * ============================================================
 *  CU-01 API — รายงานการใช้สารเคมีรายแปลง (สำหรับแอพ Chem Control)
 *  อ่านข้อมูลจาก: Sprayer APP Now › DATA AN (+ Crop Periods)
 * ------------------------------------------------------------
 *  ติดตั้ง (ครั้งเดียว) — เป็นโปรเจกต์ Apps Script แยก ไม่แตะสคริปต์เดิม
 *   1. ไปที่ https://script.google.com > New project ตั้งชื่อ "CU-01 Plot Report API"
 *   2. ลบโค้ดเดิมใน Code.gs แล้ววางไฟล์นี้ทั้งหมด > Save
 *   3. เลือกฟังก์ชัน testApi > Run (อนุญาตสิทธิ์อ่าน Sheets ครั้งแรก)
 *   4. Deploy > New deployment > ⚙ Web app
 *        Execute as: Me   |   Who has access: Anyone
 *      > Deploy > คัดลอก Web app URL (ลงท้าย /exec) ไปใส่ CU_SCRIPT_URL ใน index.html
 *
 *  GET ?action=plotData&callback=fn  -> fn({ok, updated, events:[...]})
 *  event = {r:แถว, d:'yyyy-MM-dd', p:แปลง, c:crop, s:crop period, m:sprayer, t:activity, x:[[สาร,หน่วย,ปริมาณ],...]}
 * ============================================================
 */

var CU = {
  SPREADSHEET_ID: '1lSpHJxcR8cE2bfBlb6tslaIFIqWcnVCRGfRvEXemNkg',   // Sprayer APP Now
  SRC_SHEET: 'DATA AN',
  PERIOD_SHEET: 'Crop Periods',
  CACHE_SEC: 300,            // แคช 5 นาที
  CHUNK: 90000               // CacheService จำกัด 100KB ต่อ key
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = String(p.callback || 'cb').replace(/[^\w$.]/g, '');
  var out;
  try {
    var action = p.action || 'plotData';
    if (action !== 'plotData') throw new Error('Unknown action: ' + action);
    out = cuGetJson_(p.fresh === '1');
  } catch (err) {
    out = JSON.stringify({ ok: false, error: String(err && err.message || err) });
  }
  return ContentService.createTextOutput(cb + '(' + out + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function testApi() {
  var j = JSON.parse(cuGetJson_(true));
  Logger.log('ok=%s events=%s updated=%s', j.ok, j.events.length, j.updated);
  Logger.log(JSON.stringify(j.events[j.events.length - 1]));
}

/* ---------------- cache ---------------- */

function cuGetJson_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var n = cache.get('cu_n');
    if (n) {
      var keys = [];
      for (var i = 0; i < +n; i++) keys.push('cu_' + i);
      var got = cache.getAll(keys), parts = [];
      for (var k = 0; k < keys.length; k++) { if (got[keys[k]] == null) { parts = null; break; } parts.push(got[keys[k]]); }
      if (parts) return parts.join('');
    }
  }
  var json = JSON.stringify(cuBuild_());
  try {
    var map = {}, cnt = 0;
    for (var s = 0; s < json.length; s += CU.CHUNK) map['cu_' + (cnt++)] = json.substr(s, CU.CHUNK);
    map.cu_n = String(cnt);
    cache.putAll(map, CU.CACHE_SEC);
  } catch (e) { /* แคชไม่ได้ก็ส่งข้อมูลตรง */ }
  return json;
}

/* ---------------- build ---------------- */

function cuBuild_() {
  var ss = SpreadsheetApp.openById(CU.SPREADSHEET_ID);
  var tz = ss.getSpreadsheetTimeZone();
  var src = ss.getSheetByName(CU.SRC_SHEET);
  if (!src) throw new Error('ไม่พบ sheet ' + CU.SRC_SHEET);
  var ps = ss.getSheetByName(CU.PERIOD_SHEET);
  var periods = cuParsePeriods(ps ? ps.getDataRange().getValues() : []);
  var events = cuParseEvents(src.getDataRange().getValues(), periods).map(function (e) {
    return {
      r: e.row, d: e.date ? Utilities.formatDate(e.date, tz, 'yyyy-MM-dd') : '',
      p: e.plot, c: e.crop, s: e.period, m: e.sprayer, t: e.activity,
      x: e.chems.map(function (c) { return [c.name, c.unit, Math.round(c.qty * 1000) / 1000]; })
    };
  });
  return { ok: true, updated: Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm"), events: events };
}

/* ============ Pure logic (no Spreadsheet calls) ============ */

var CU_MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function cuParseDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 864e5));
  var s = String(v == null ? '' : v).trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2})\s*([A-Za-z]{3})[A-Za-z]*\s*(\d{2,4})$/);   // 5May24, 31 May2026
  if (m && CU_MON[m[2].toLowerCase()] != null) {
    var y = +m[3]; if (y < 100) y += 2000;
    return new Date(y, CU_MON[m[2].toLowerCase()], +m[1]);
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);           // 17/11/2026 (d/m/y)
  if (m) { var yy = +m[3]; if (yy < 100) yy += 2000; return new Date(yy, +m[2] - 1, +m[1]); }
  var d = new Date(s);
  return isNaN(d) ? null : d;
}

function cuNum(v) {
  if (typeof v === 'number') return v;
  var s = String(v == null ? '' : v).replace(/[,\s$]/g, '');
  if (!s || s === '-') return 0;
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** "Rain Season / 26" และ "Rain Season 26" -> rain26 ; "Dry Season / 25" และ "Dry Season 25-26" -> dry25 */
function cuPeriodKey(label) {
  var s = String(label || '').toLowerCase();
  var t = s.indexOf('rain') >= 0 ? 'rain' : s.indexOf('dry') >= 0 ? 'dry' : '';
  var m = s.match(/\d{2,4}/);
  if (!t || !m) return '';
  return t + m[0].slice(-2);
}

function cuParsePeriods(values) {
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var name = String(values[i][0] || '').trim();
    if (!name) continue;
    out.push({ name: name, key: cuPeriodKey(name), start: cuParseDate(values[i][1]), end: cuParseDate(values[i][2]) });
  }
  return out;
}

/** ใช้คอลัมน์ Crop period ก่อน (จับคู่ชื่อกับ Crop Periods) ถ้าว่างใช้วันที่เทียบช่วงใน Crop Periods */
function cuResolvePeriod(raw, date, periods) {
  raw = String(raw || '').trim();
  if (raw) {
    var k = cuPeriodKey(raw);
    for (var i = 0; i < periods.length; i++) if (k && periods[i].key === k) return periods[i].name;
    return raw;
  }
  if (date) {
    for (var j = 0; j < periods.length; j++) {
      var p = periods[j];
      if (p.start && p.end && date >= p.start && date <= new Date(p.end.getTime() + 864e5 - 1)) return p.name;
    }
  }
  return '(ไม่ระบุฤดูกาล)';
}

function cuUnitOf(header) {
  var m = String(header).match(/\(\s*(kg|l|ml|g)\s*\)\s*$/i);
  if (!m) return '';
  var u = m[1].toLowerCase();
  return u === 'kg' ? 'Kg' : u === 'l' ? 'L' : u;
}

function cuChemName(header) {
  return String(header).replace(/\(\s*(kg|l|ml|g)\s*\)\s*$/i, '').trim();
}

function cuParseEvents(data, periods) {
  if (!data.length) return [];
  var h = data[0].map(function (x) { return String(x).trim(); });
  function col(name) {
    var n = name.toLowerCase();
    for (var i = 0; i < h.length; i++) if (h[i].toLowerCase() === n) return i;
    return -1;
  }
  var cDate = col('Date'), cPlot = col('Plot'), cCrop = col('Crop'), cPer = col('Crop period'),
      cSpr = col('Type Sprayer'), cAct = col('Activity'), cAction = col('Action Day');
  var chemStart = cAction >= 0 ? cAction + 1 : 16;      // สารเคมีเริ่มหลังคอลัมน์ Action Day
  var chems = [];
  for (var c = chemStart; c < h.length; c++) {
    if (h[c]) chems.push({ idx: c, name: cuChemName(h[c]), unit: cuUnitOf(h[c]) });
  }
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var plot = String(row[cPlot] || '').trim();
    if (!plot) continue;
    var date = cuParseDate(row[cDate]);
    var used = [];
    chems.forEach(function (ch) {
      var q = cuNum(row[ch.idx]);
      if (q > 0) used.push({ name: ch.name, unit: ch.unit, qty: q });
    });
    out.push({
      row: r + 1, date: date, plot: plot,
      crop: String(row[cCrop] || '').trim(),
      period: cuResolvePeriod(cPer >= 0 ? row[cPer] : '', date, periods),
      sprayer: cSpr >= 0 ? String(row[cSpr] || '').trim() : '',
      activity: cAct >= 0 ? String(row[cAct] || '').trim() : '',
      chems: used
    });
  }
  return out;
}

/* node test export (ไม่มีผลใน Apps Script) */
if (typeof module !== 'undefined') {
  module.exports = { cuParseEvents: cuParseEvents, cuParsePeriods: cuParsePeriods };
}
