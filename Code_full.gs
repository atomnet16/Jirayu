// ═══════════════════════════════════════════════════════════════════
//  Chem Control · Mega Farm — Google Apps Script
//  Sheets: CR-01 | MX-01 | SP-01 | ST-01 | RT-01 | STOCK_INIT
//  Actions: getAll | append | appendMany | update | delete
// ═══════════════════════════════════════════════════════════════════

var SS = SpreadsheetApp.getActiveSpreadsheet();

// ── Sheet column definitions ────────────────────────────────────────
var SCHEMA = {
  'CR-01': ['ID','Date','Requester','Approver','Chemicals','Note','CreatedAt','UpdatedAt'],
  'MX-01': ['ID','Date','Time','Mixer','Plot','Sprayer',
             'WaterPerTank','TotalWater','SprayType','Note','CreatedAt','UpdatedAt'],
  'SP-01': ['ID','Date','TStart','TEnd','Hrs','HaH','Operator',
             'Plot','Area','Weather','Wind','MxId',
             'WaterBefore','WaterAfter','WaterUsed','ChemDelivered','Note','CreatedAt','UpdatedAt'],
  'ST-01': ['ID','Date','Ref','Receiver','Approver','Chemicals','Note','CreatedAt','UpdatedAt'],
  'RT-01': ['ID','Date','Reason','ReturnedBy','Receiver','Chemicals','Note','CreatedAt','UpdatedAt']
};

// ── Spray type classification (priority: Burn down > Pre-emergence > Post-emergence > Insecticide) ──
var SPRAY_TYPE_RULES_GAS = [
  {label:'Burn down',     chems:['Glyphosate','Glufosinate','2,4-D','Fluazifop']},
  {label:'Pre-emergence', chems:['Dual Gold','Pendimethalin','Acetochlor']},
  {label:'Post-emergence',chems:['Clio Pro','Atrazine','Nicosulfuron (Green)','Fomesafen (Flex)','Fomesafen (Farma)']},
  {label:'Insecticide',   chems:['Emamecthrin','Belt','Lufenuron','Fipronil','Altacor','Profenofos','Eforia','Amrarar','Spirotetramat','Chlorfenapyr','Bifentrin (Talstar)','Methomyl']}
];
function computeSprayType(allChems) {
  if (!allChems || typeof allChems !== 'object') return '';
  var chemNames = Object.keys(allChems).filter(function(k){ return parseFloat(allChems[k]) > 0; });
  for (var i = 0; i < SPRAY_TYPE_RULES_GAS.length; i++) {
    var rule = SPRAY_TYPE_RULES_GAS[i];
    if (rule.chems.some(function(c){ return chemNames.indexOf(c) >= 0; })) return rule.label;
  }
  return '';
}

// ── Corn growth stage (เขียน column Stage ใน MX-01) ──────────────────
// D0 = วัน Burn down / Pre-emergence ล่าสุดที่ <= วันของแถว (ปลูกรอบใหม่ = reset)
var STAGE_TABLE_GAS = [['Planting',0],['VE',4],['V1',7],['V2',10],['V3',13],['V4',16],['V5',19],['V6',22],['V7',25],['V8',28],['V9',31],['V10',33],['V11',36],['V12',39],['V13',42],['V14',45],['V15',48],['R1',51],['R2',60],['R3',70],['R4',80],['R5',90],['R6',105]];
function stageFromDaysGAS(d) {
  if (d == null || d < 0) return '';
  var s = STAGE_TABLE_GAS[0][0];
  for (var i = 0; i < STAGE_TABLE_GAS.length; i++) { if (d >= STAGE_TABLE_GAS[i][1]) s = STAGE_TABLE_GAS[i][0]; else break; }
  return s;
}
// scan ทั้ง MX-01 → จัดกลุ่มตาม plot → หา anchor → เขียน column Stage
function updateMXStages() {
  var sh = SS.getSheetByName('MX-01');
  if (!sh) return;
  var tz = Session.getScriptTimeZone();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
  var iStage = headers.indexOf('Stage');
  if (iStage < 0) {
    sh.getRange(1, lastCol+1).setValue('Stage')
      .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
    headers.push('Stage'); iStage = headers.length - 1;
  }
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var iDate = headers.indexOf('Date'), iPlot = headers.indexOf('Plot'), iType = headers.indexOf('SprayType');
  if (iDate < 0 || iPlot < 0) return;
  // chem ที่ใช้ระบุ Burn down/Pre-emergence (พอสำหรับหา anchor)
  var anchorChems = {};
  SPRAY_TYPE_RULES_GAS.forEach(function(rule){
    if (rule.label === 'Burn down' || rule.label === 'Pre-emergence')
      rule.chems.forEach(function(c){ anchorChems[c] = rule.label; });
  });
  function normDate(v){
    if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return String(v||'').substring(0,10);
  }
  function rowType(row){
    if (iType >= 0) { var t = String(row[iType]||'').trim(); if (t) return t; }
    var ac = {};
    headers.forEach(function(h,ci){ var v = parseFloat(row[ci]); if (!isNaN(v) && v>0 && anchorChems[h] !== undefined) ac[h] = v; });
    return computeSprayType(ac);
  }
  // anchor dates ต่อ plot
  var anchorsByPlot = {};
  for (var i = 1; i < data.length; i++) {
    var plot = String(data[i][iPlot]||'').trim(), d = normDate(data[i][iDate]);
    if (!plot || !d) continue;
    var t = rowType(data[i]);
    if (t === 'Burn down' || t === 'Pre-emergence') {
      if (!anchorsByPlot[plot]) anchorsByPlot[plot] = [];
      anchorsByPlot[plot].push(d);
    }
  }
  Object.keys(anchorsByPlot).forEach(function(p){ anchorsByPlot[p].sort(); });
  // เขียน Stage ทีละแถว
  var out = [];
  for (var j = 1; j < data.length; j++) {
    var plot2 = String(data[j][iPlot]||'').trim(), d2 = normDate(data[j][iDate]), stage = '';
    if (plot2 && d2 && anchorsByPlot[plot2]) {
      var best = null;
      anchorsByPlot[plot2].forEach(function(a){ if (a <= d2 && (best === null || a > best)) best = a; });
      if (best) {
        var diff = Math.round((new Date(d2+'T00:00:00') - new Date(best+'T00:00:00'))/86400000);
        stage = stageFromDaysGAS(diff);
      }
    }
    out.push([stage]);
  }
  if (out.length) sh.getRange(2, iStage+1, out.length, 1).setValues(out);
}

// ── Field value lookup ─────────────────────────────────────────────
function getFieldValue(header, d) {
  var j = function(v) { return (v && typeof v === 'object') ? JSON.stringify(v) : (v !== undefined && v !== null ? String(v) : ''); };
  var map = {
    'ID':              d.id            || '',
    'Date':            d.date          || '',
    'Time':            d.time          || '',
    'TStart':          d.tStart        || '',
    'TEnd':            d.tEnd          || '',
    'Hrs':             d.hrs           || '',
    'HaH':             d.haH           || '',
    'Mixer':           d.mixer         || '',
    'Supervisor':      d.supervisor    || '',
    'Operator':        d.operator      || '',
    'Plot':            d.plot          || '',
    'Sprayer':         d.sprayer       || '',
    'Area':            d.area          || '',
    'Weather':         d.weather       || '',
    'Wind':            d.wind          || '',
    'MxId':            d.mxId          || '',
    'WaterPerTank':    d.waterPerTank  || 0,
    'TotalWater':      d.totalWater    || 0,
    'SprayType':       d.allChems ? computeSprayType(d.allChems) : (d.sprayType || ''),
    'WaterBefore':     d.waterBefore   || 0,
    'WaterAfter':      d.waterAfter    || 0,
    'WaterUsed':       d.waterUsed     || 0,
    'Water/Tank(L)':   d.waterPerTank  || 0,
    'Total Water(L)':  d.totalWater    || 0,
    'Water Used(L)':   d.waterUsed     || 0,
    'Area(ha)':        d.area          || '',
    'ChemDelivered':   j(d.chemDelivered),
    'Chemicals':       j(d.chemicals),
    'Requester':       d.requester     || '',
    'Approver':        d.approver      || '',
    'Receiver':        d.receiver      || '',
    'ReturnedBy':      d.returnedBy    || '',
    'Reason':          d.reason        || '',
    'Ref':             d.ref           || '',
    'Note':            d.note          || '',
    'CreatedAt':       d.createdAt     || '',
    'UpdatedAt':       d.updatedAt     || ''
  };
  return map.hasOwnProperty(header) ? map[header] : '';
}

// ── Row builder ───────────────────────────────────────────────────
function buildRow(sheetName, d, headers) {
  var h = (headers && headers.length > 0) ? headers : (SCHEMA[sheetName] || []);
  if (!h.length) return [];
  var hasChemicalsCol = h.indexOf('Chemicals') >= 0;
  var chemSheets = { 'CR-01': true, 'ST-01': true, 'RT-01': true };
  var j = function(v) { return (v && typeof v === 'object') ? JSON.stringify(v) : (v !== undefined && v !== null ? String(v) : ''); };
  return h.map(function(header) {
    if (header === 'Note' && !hasChemicalsCol && chemSheets[sheetName]) {
      return d.chemicals && d.chemicals.length ? j(d.chemicals) : (d.note || '');
    }
    return getFieldValue(header, d);
  });
}

// ── Write allChems to individual columns in MX-01 ────────────────
function appendChemicals(sh, rowNum, allChems) {
  if (!allChems || typeof allChems !== 'object') return;
  var keys = Object.keys(allChems);
  if (keys.length === 0) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  // normalize: ตัด suffix หน่วย "(Kg)"/"(L)" + ช่องว่าง เพื่อจับคู่คอลัมน์ที่ชื่อไม่ตรงเป๊ะ
  function norm(s){ return String(s).replace(/\s*\([A-Za-z]+\)\s*$/, '').replace(/\s+/g,' ').trim().toLowerCase(); }
  var headerIdx = {};
  headers.forEach(function(h, i){ var n = norm(h); if (n && !(n in headerIdx)) headerIdx[n] = i; });
  keys.forEach(function(chemName) {
    var val = parseFloat(allChems[chemName]);
    if (isNaN(val) || val <= 0) return;
    var colIdx = headers.indexOf(chemName);
    if (colIdx < 0) {
      var nIdx = headerIdx[norm(chemName)];
      if (nIdx !== undefined) colIdx = nIdx;
    }
    if (colIdx >= 0) sh.getRange(rowNum, colIdx + 1).setValue(val);
  });
}

// ── SP-01 Summary Sheet ──────────────────────────────────────────
function updateSPSummary() {
  var spSh = SS.getSheetByName('SP-01');
  if (!spSh) return;
  var data = spSh.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var iDate = headers.indexOf('Date');
  var iPlot = headers.indexOf('Plot');
  var iArea = headers.indexOf('Area');
  var iOp   = headers.indexOf('Operator');
  var iHrs  = headers.indexOf('Hrs');
  var rows = data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    var rawDate = r[iDate] || '';
    var dateStr = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(rawDate).substring(0, 10);
    return [dateStr, r[iPlot]||'', r[iOp]||'', parseFloat(r[iArea])||0, parseFloat(r[iHrs])||0];
  });
  rows.sort(function(a,b){ return b[0]>a[0]?1:b[0]<a[0]?-1:0; });
  var sumSh = SS.getSheetByName('สรุป SP-01');
  if (!sumSh) { sumSh = SS.insertSheet('สรุป SP-01'); } else { sumSh.clearContents(); }
  sumSh.getRange(1,1,1,5).setValues([['วันที่','แปลง','Operator','พื้นที่ (Ha)','ชั่วโมง (Hr)']])
    .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
  sumSh.setFrozenRows(1);
  if (rows.length > 0) {
    sumSh.getRange(2,1,rows.length,5).setValues(rows);
    for (var i=0;i<rows.length;i++) sumSh.getRange(i+2,1,1,5).setBackground(i%2===0?'#f4f8f5':'#ffffff');
  }
  var totRow = rows.length+2;
  sumSh.getRange(totRow,1,1,5).setValues([['รวม','','',
    rows.reduce(function(s,r){return s+r[3];},0),
    rows.reduce(function(s,r){return s+r[4];},0)]])
    .setBackground('#d4e4da').setFontWeight('bold');
  [100,120,100,110,110].forEach(function(w,i){ sumSh.setColumnWidth(i+1,w); });
}

// ── Deleted IDs ───────────────────────────────────────────────────
function getDeletedIds() {
  var sh = SS.getSheetByName('DELETED');
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  return vals.slice(1).map(function(r){ return String(r[0]); }).filter(Boolean);
}
function logDelete(id) {
  var sh = SS.getSheetByName('DELETED');
  if (!sh) {
    sh = SS.insertSheet('DELETED');
    sh.getRange(1,1,1,2).setValues([['ID','DeletedAt']]);
    sh.getRange(1,1,1,2).setBackground('#3d1a1a').setFontColor('#ff6666').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var existing = sh.getDataRange().getValues().slice(1).map(function(r){ return String(r[0]); });
  if (existing.indexOf(String(id)) < 0) sh.appendRow([String(id), new Date().toISOString()]);
}

// ── Ensure sheet exists ───────────────────────────────────────────
function ensureSheet(name) {
  var sh = SS.getSheetByName(name);
  if (!sh) {
    sh = SS.insertSheet(name);
    var cols = SCHEMA[name] || ['ID'];
    sh.getRange(1,1,1,cols.length).setValues([cols])
      .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ── Ensure UpdatedAt column exists (สำคัญ: ใช้เทียบเวลากันข้อมูลเก่าเขียนทับ) ──
// ถ้าไม่มีคอลัมน์นี้ appendMany จะ overwrite ทุก sync → ข้อมูลเด้งกลับ
function ensureUpdatedAtCol(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  var headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
  if (headers.indexOf('UpdatedAt') < 0) {
    sh.getRange(1, lastCol+1).setValue('UpdatedAt')
      .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
  }
}

// ── รันมือ 1 ครั้ง: เติม UpdatedAt ให้แถวเก่าที่ยังว่าง (= CreatedAt หรือ now) ──
// แถวที่ UpdatedAt ว่าง = ช่องโหว่ bounce (ถูก push ทับได้) → เติมให้ครบเพื่อปิดช่องโหว่
function backfillUpdatedAt() {
  var sheets = ['CR-01','MX-01','SP-01','ST-01','RT-01'];
  var totalFilled = 0;
  sheets.forEach(function(name){
    var sh = SS.getSheetByName(name);
    if (!sh) return;
    ensureUpdatedAtCol(sh);
    var data = sh.getDataRange().getValues();
    if (data.length < 2) return;
    var headers = data[0].map(function(h){ return String(h).trim(); });
    var iU = headers.indexOf('UpdatedAt'), iC = headers.indexOf('CreatedAt');
    if (iU < 0) return;
    var filled = 0;
    for (var i = 1; i < data.length; i++) {
      if (!String(data[i][0]||'').trim()) continue;          // ข้ามแถวว่าง (ไม่มี ID)
      var cur = data[i][iU];
      var curStr = (cur instanceof Date) ? '' : String(cur||'').trim();
      if (curStr && /T.*Z$/.test(curStr)) continue;          // เป็น ISO UTC อยู่แล้ว → ข้าม
      // เติม/แปลงเป็น ISO UTC: ใช้ UpdatedAt เดิม (ถ้ามี) ไม่งั้น CreatedAt ไม่งั้น now
      var ms = tsMs(cur) || (iC>=0 ? tsMs(data[i][iC]) : 0) || Date.now();
      sh.getRange(i+1, iU+1).setValue(new Date(ms).toISOString());
      filled++;
    }
    totalFilled += filled;
  });
  SpreadsheetApp.getActive().toast('✅ backfill UpdatedAt: เติม '+totalFilled+' แถว', 'backfillUpdatedAt', 8);
  Logger.log('backfillUpdatedAt filled: '+totalFilled);
}

// ── Ensure water columns ──────────────────────────────────────────
function ensureWaterCols(sh, sheetName) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  var headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
  var pairs = sheetName === 'SP-01'
    ? [['MxId',''],['WaterBefore',''],['WaterAfter',''],['WaterUsed','Water Used(L)'],['ChemDelivered','']]
    : [['WaterPerTank','Water/Tank(L)'],['TotalWater','Total Water(L)']];
  var toAdd = [];
  pairs.forEach(function(pr){
    if (headers.indexOf(pr[0])<0 && (!pr[1]||headers.indexOf(pr[1])<0)) toAdd.push(pr[0]);
  });
  if (toAdd.length) {
    sh.getRange(1,sh.getLastColumn()+1,1,toAdd.length).setValues([toAdd])
      .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
  }
}

// ── Read sheet as objects ─────────────────────────────────────────
function sheetToObjects(name) {
  var sh = SS.getSheetByName(name);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var tz = Session.getScriptTimeZone();
  return data.slice(1).map(function(row){
    var obj = {};
    headers.forEach(function(h,i){
      var v = row[i];
      obj[h] = (v instanceof Date && !isNaN(v)) ? Utilities.formatDate(v,tz,'yyyy-MM-dd') : v;
    });
    return obj;
  }).filter(function(r){ return r.ID || r.id; });
}

// ── JSONP helpers ─────────────────────────────────────────────────
function jsonpOk(callback, payload) {
  return ContentService.createTextOutput(callback+'('+JSON.stringify(payload)+')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function jsonpErr(callback, msg) { return jsonpOk(callback,{ok:false,error:msg}); }

// ═══════════════════════════════════════════════════════════════════
//  STOCK_INIT — ปริมาณตั้งต้นจาก Sheet (แก้ได้ทุกรอบนับสต๊อก)
//  Tab: STOCK_INIT | คอลัมน์: A Chemical B Unit C SnapQty D SnapDate
//                              E CR_Issued(auto) F CalcQty(auto)
//                              G PhysCount H Variance(=G-F) I CountDate
//  ผู้ปฏิบัติกรอกแค่: C, D, G  |  ระบบคำนวณ: E, F, H
// ═══════════════════════════════════════════════════════════════════

var STOCK_INIT_SHEET = 'STOCK_INIT';

function getStockInit() {
  var sh = SS.getSheetByName(STOCK_INIT_SHEET);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var tz = Session.getScriptTimeZone();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var chem = String(r[0]||'').trim();
    if (!chem) continue;
    var sd = r[3];
    if (sd instanceof Date && !isNaN(sd)) sd = Utilities.formatDate(sd,tz,'yyyy-MM-dd');
    else sd = String(sd||'').substring(0,10);
    out.push({ chemical:chem, unit:String(r[1]||'').trim(), snapQty:parseFloat(r[2])||0, snapDate:sd });
  }
  return out;
}

function updateStockInitCalc() {
  var sh = SS.getSheetByName(STOCK_INIT_SHEET);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var tz = Session.getScriptTimeZone();

  // รวบรวม CR-01 ทุกรายการ
  var crSh = SS.getSheetByName('CR-01');
  var crRows = crSh ? crSh.getDataRange().getValues() : [];
  var crList = [];
  if (crRows.length > 1) {
    var h = crRows[0].map(function(x){ return String(x).trim(); });
    var iDate = h.indexOf('Date');
    var iChem = h.indexOf('Chemicals'); if (iChem<0) iChem = h.indexOf('Note');
    for (var i = 1; i < crRows.length; i++) {
      var rr = crRows[i];
      var d = rr[iDate];
      if (d instanceof Date && !isNaN(d)) d = Utilities.formatDate(d,tz,'yyyy-MM-dd');
      else d = String(d||'').substring(0,10);
      var chems = [];
      try { var p=JSON.parse(rr[iChem]); if(Array.isArray(p)) chems=p; } catch(e){}
      crList.push({date:d, chems:chems});
    }
  }

  // เขียน E (CR_Issued) + F (CalcQty) ทีละแถว
  for (var j = 1; j < data.length; j++) {
    var chem = String(data[j][0]||'').trim();
    if (!chem) continue;
    var snapQty = parseFloat(data[j][2])||0;
    var sd = data[j][3];
    if (sd instanceof Date && !isNaN(sd)) sd = Utilities.formatDate(sd,tz,'yyyy-MM-dd');
    else sd = String(sd||'').substring(0,10);
    var issued = 0;
    crList.forEach(function(cr){
      if (sd && cr.date && cr.date < sd) return;
      cr.chems.forEach(function(c){
        if (String(c.n).trim()===chem) issued += parseFloat(c.q)||0;
      });
    });
    sh.getRange(j+1,5).setValue(issued);           // E: CR_Issued
    sh.getRange(j+1,6).setValue(snapQty - issued); // F: CalcQty
  }
}

// ── รัน 1 ครั้งเพื่อสร้าง Tab STOCK_INIT พร้อมสารเคมี 46 ตัว ─────
function seedStockInit() {
  var sh = SS.getSheetByName(STOCK_INIT_SHEET);
  if (sh) SS.deleteSheet(sh);
  sh = SS.insertSheet(STOCK_INIT_SHEET);

  var hdr = ['Chemical','Unit','SnapQty','SnapDate','CR_Issued','CalcQty','PhysCount','Variance','CountDate'];
  sh.getRange(1,1,1,hdr.length).setValues([hdr])
    .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
  sh.setFrozenRows(1);

  var SEED = [
    ['Emamecthrin','Kg',216.5],['Belt','Kg',280.7],['Lufenuron','L',944],
    ['Fipronil','L',0],['Altacor','Kg',0],['Profenofos','L',783.5],
    ['Actara (Thiamethoxam)','Kg',7.5],['Eforia','L',1745.5],['Amrarar','Kg',0],
    ['Spirotetramat','L',94.3],['Chlorfenapyr','L',1774],['Bifentrin (Talstar)','L',258],
    ['Methomyl','Kg',13],['Glyphosate','L',0],['Dual Gold','L',3639.5],
    ['2,4-D','L',750],['Clio Pro','L',124.4],['Atrazine','Kg',1797.9],
    ['Nicosulfuron (Green)','L',113.65],['Nicosulfuron (Yellow)','L',37],
    ['Sumisoya','Kg',53.7],['Glufosinate','L',3873],['Pendimethalin','L',3879],
    ['Acetochlor','L',640],['Imazetapyr (Pursuit)','L',874.6],
    ['Indaziflam (Becano)','L',19.3],['Metribuzin (Sencor)','Kg',162.25],
    ['Quizalofop (Clifton)','L',714],['Fomesafen (Flex)','L',112.75],
    ['Fomesafen (Farma)','L',1912],['Ametryn 80','Kg',145],['Fluazifop','L',2160],
    ['Carbendazim','L',0.5],['Nativo','Kg',0.3],['Atemis','L',1021],
    ['Mammoth Zinc','L',35],['Mammoth Ca+B','L',100],['Surfactant','L',1123.15],
    ['K30','L',2461.8],['CoMo','L',200],['Levos','Kg',1145],
    ['MgSO4','Kg',0],['Euro seed','L',0],['Fergan','L',0],
    ['Vetget oil','L',0],['Virtus','Kg',0]
  ];
  var SNAP_DATE = '2026-06-14';
  var rows = SEED.map(function(s){ return [s[0],s[1],s[2],SNAP_DATE,'','','','','']; });
  sh.getRange(2,1,rows.length,9).setValues(rows);

  // H Variance = G − F (สูตร Sheet คำนวณเมื่อกรอก G)
  for (var i = 0; i < rows.length; i++) {
    var r = i+2;
    sh.getRange(r,8).setFormula('=IF(G'+r+'="","",G'+r+'-F'+r+')');
  }
  sh.setColumnWidth(1,170); sh.setColumnWidth(4,100); sh.setColumnWidth(9,100);
  updateStockInitCalc();
  SpreadsheetApp.getActive().toast('✅ STOCK_INIT พร้อมใช้: '+rows.length+' สารเคมี');
}

// ═══════════════════════════════════════════════════════════════════
//  fixMXfromDataAN — แก้ chemical columns ใน MX-01 ให้ตรงกับ DATA AN
//  วิธีใช้: เปิด GAS Editor → รัน fixMXfromDataAN()
//  ผลลัพธ์: อัพเดท chemical columns ใน MX-01 ตาม date+plot จาก DATA AN
// ═══════════════════════════════════════════════════════════════════

// Map ชื่อ column DATA AN → ชื่อ CHEMS ในแอป
var DATA_AN_ALIAS = {
  'Emamecthrin (Kg)':            'Emamecthrin',
  'Belt (Kg)':                   'Belt',
  'Lufenuron (L)':               'Lufenuron',
  'Fipronil (L)':                'Fipronil',
  'Altacor (Kg)':                'Altacor',
  'Profenofos (L)':              'Profenofos',
  'Actara (Thiamethoxam) (Kg)':  'Actara (Thiamethoxam)',
  'Methomyl (Kg)':               'Methomyl',
  'Eforia (L)':                  'Eforia',
  'Amrarar (Kg)':                'Amrarar',
  'Chlorfenapyr (L)':            'Chlorfenapyr',
  'Bifentrin (Talstar)':         'Bifentrin (Talstar)',
  'Glyphosate (L)':              'Glyphosate',
  'Dual Gold (L)':               'Dual Gold',
  '2,4-D (L)':                   '2,4-D',
  'Clio Pro (L)':                'Clio Pro',
  'Fluazipob (L)':               'Fluazifop',        // typo ใน Sheet
  'Atrazine (Kg)':               'Atrazine',
  'Nicosulfuron (L)':            'Nicosulfuron (Green)',
  'Sumisoya (Kg)':               'Sumisoya',
  'Acetochlor (L)':              'Acetochlor',
  'Glufosinate (L)':             'Glufosinate',
  'Pendimethalin (L)':           'Pendimethalin',
  'Ametryn (Kg)':                'Ametryn 80',       // ชื่อต่างกัน
  'Becano (Indaziflam)':         'Indaziflam (Becano)',
  'Nativo (Kg)':                 'Nativo',
  'Atemis (L)':                  'Atemis',
  'Mammoth Zinc (L)':            'Mammoth Zinc',
  'Mammoth Ca+B (L)':            'Mammoth Ca+B',
  'K30 (L)':                     'K30',
  'Euro seed (L)':               'Euro seed',
  'Virtus (Kg)':                 'Virtus',
  'MgSO4 (KG)':                  'MgSO4',
  'Fergan (L)':                  'Fergan',
  'Vetget oil (L)':              'Vetget oil',
  'Surfactant (L)':              'Surfactant',
};

function fixMXfromDataAN() {
  var tz = Session.getScriptTimeZone();
  var anSh  = SS.getSheetByName('DATA AN');
  var mxSh  = SS.getSheetByName('MX-01');
  if (!anSh) { SpreadsheetApp.getActive().toast('❌ ไม่พบ sheet DATA AN'); return; }
  if (!mxSh) { SpreadsheetApp.getActive().toast('❌ ไม่พบ sheet MX-01');   return; }

  // อ่าน DATA AN
  var anData    = anSh.getDataRange().getValues();
  var anHeaders = anData[0].map(function(h){ return String(h).trim(); });
  var iDate  = anHeaders.indexOf('Date');
  var iPlot  = anHeaders.indexOf('Plot');

  // อ่าน MX-01
  var mxData    = mxSh.getDataRange().getValues();
  var mxHeaders = mxData[0].map(function(h){ return String(h).trim(); });

  // ── ตรวจว่า MX-01 มี chemical columns พอ ── เพิ่มถ้าขาด
  var needCols = Object.values(DATA_AN_ALIAS);
  var toAdd = needCols.filter(function(n){ return mxHeaders.indexOf(n) < 0; });
  if (toAdd.length > 0) {
    var startCol = mxSh.getLastColumn() + 1;
    mxSh.getRange(1, startCol, 1, toAdd.length).setValues([toAdd])
      .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
    // reload headers
    mxData    = mxSh.getDataRange().getValues();
    mxHeaders = mxData[0].map(function(h){ return String(h).trim(); });
  }

  var iMxDate = mxHeaders.indexOf('Date');
  var iMxPlot = mxHeaders.indexOf('Plot');

  // สร้าง key date+plot สำหรับ MX-01 แต่ละแถว
  function normDate(v) {
    if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return String(v||'').substring(0,10);
  }
  function normPlot(v) { return String(v||'').trim().toLowerCase(); }

  // Build index: "date|plot" → [rowIndex, ...]  (MX-01 แถว 1-based ใน sheet = index+1 ใน array +1 header)
  var mxIndex = {};
  for (var i = 1; i < mxData.length; i++) {
    var key = normDate(mxData[i][iMxDate]) + '|' + normPlot(mxData[i][iMxPlot]);
    if (!mxIndex[key]) mxIndex[key] = [];
    mxIndex[key].push(i + 1); // row number in sheet (1-based, +1 for header)
  }

  var updated = 0, skipped = 0;

  // วนแต่ละแถว DATA AN
  for (var r = 1; r < anData.length; r++) {
    var row = anData[r];
    // ตรวจว่ามี chemical ค่าบ้างไหม
    var hasData = false;
    anHeaders.forEach(function(h, ci) {
      if (DATA_AN_ALIAS[h] && parseFloat(row[ci]) > 0) hasData = true;
    });
    if (!hasData) { skipped++; continue; }

    var anDate = normDate(row[iDate]);
    var anPlot = normPlot(row[iPlot]);
    if (!anDate || !anPlot) { skipped++; continue; }

    var key = anDate + '|' + anPlot;
    var mxRows = mxIndex[key];
    if (!mxRows || mxRows.length === 0) { skipped++; continue; }

    // เขียนทุก MX-01 row ที่ตรง date+plot
    mxRows.forEach(function(mxRowNum) {
      anHeaders.forEach(function(anCol, ci) {
        var chemName = DATA_AN_ALIAS[anCol];
        if (!chemName) return;
        var val = parseFloat(row[ci]);
        if (isNaN(val) || val <= 0) return;
        var colIdx = mxHeaders.indexOf(chemName);
        if (colIdx >= 0) {
          mxSh.getRange(mxRowNum, colIdx + 1).setValue(val);
        }
      });
    });
    updated++;
  }

  SpreadsheetApp.getActive().toast(
    '✅ อัพเดทแล้ว ' + updated + ' วัน | ข้ามไป ' + skipped + ' วัน (ไม่มีข้อมูล/ไม่พบใน MX-01)',
    'fixMXfromDataAN', 8
  );
  Logger.log('Updated: ' + updated + ' | Skipped: ' + skipped);
}

// ═══════════════════════════════════════════════════════════════════
//  doGet — JSONP
// ═══════════════════════════════════════════════════════════════════
function doGet(e) {
  var p  = e.parameter || {};
  var cb = p.callback || 'cb';
  var action = p.action || 'getAll';
  try {
    if (action === 'getAll') {
      var result = {};
      ['CR-01','MX-01','SP-01','ST-01','RT-01'].forEach(function(name){
        result[name] = sheetToObjects(name);
      });
      // ★ ส่ง stockInit กลับพร้อมกับ getAll
      return jsonpOk(cb, { ok:true, data:result, deletedIds:getDeletedIds(), stockInit:getStockInit() });
    }
    if (action === 'delete') {
      var sheetName = p.sheet, id = p.id;
      if (!sheetName||!id) return jsonpErr(cb,'Missing sheet or id');
      var sh = SS.getSheetByName(sheetName);
      if (!sh) return jsonpErr(cb,'Sheet not found: '+sheetName);
      var vals = sh.getDataRange().getValues();
      for (var i = vals.length-1; i >= 1; i--) {
        if (String(vals[i][0])===String(id)) {
          sh.deleteRow(i+1);
          logDelete(id);
          return jsonpOk(cb,{ok:true,deleted:id});
        }
      }
      return jsonpErr(cb,'ID not found: '+id);
    }
    return jsonpErr(cb,'Unknown GET action: '+action);
  } catch(err) {
    return jsonpErr(cb,err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  doPost — no-cors write
// ═══════════════════════════════════════════════════════════════════
// ── แปลง timestamp ทุกชนิด → epoch ms (แก้ root cause ของ bounce) ──
// รองรับ: Date object (Sheet auto-convert), ISO UTC จาก client ("...T03..Z"),
// local-no-Z จาก backfill เก่า ("...T10"), locale string ของ Sheet, ค่าว่าง.
// เดิมเทียบ timestamp แบบ string → ISO UTC ดู "เก่ากว่า" local 7 ชม. → ค่าเก่าทับค่าใหม่.
function tsMs(v){
  if (v instanceof Date) return isNaN(v.getTime()) ? 0 : v.getTime();
  var s = String(v||'').trim();
  if (!s) return 0;
  var t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;

    if (action === 'append') {
      var sheetName = payload.sheet;
      if (!sheetName||!SCHEMA[sheetName]) return ok('unknown sheet');
      var sh = ensureSheet(sheetName);
      if (sheetName==='MX-01'||sheetName==='SP-01') ensureWaterCols(sh,sheetName);
      ensureUpdatedAtCol(sh);
      var shHeaders = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(h){ return String(h).trim(); });
      var row = buildRow(sheetName,payload,shHeaders);
      if (!row.length) return ok('empty row');
      var ids = sh.getDataRange().getValues().slice(1).map(function(r){ return String(r[0]); });
      if (ids.indexOf(String(payload.id))<0) {
        sh.appendRow(row);
        if (sheetName==='MX-01'&&payload.allChems) appendChemicals(sh,sh.getLastRow(),payload.allChems);
        if (sheetName==='MX-01') { try { updateMXStages(); } catch(e) {} }
        if (sheetName==='SP-01') updateSPSummary();
      }
      return ok('appended '+payload.id);
    }

    if (action === 'update') {
      var sheetName = payload.sheet, id = payload.id;
      if (!sheetName||!id||!SCHEMA[sheetName]) return ok('unknown sheet or missing id');
      var sh = ensureSheet(sheetName);
      if (sheetName==='MX-01'||sheetName==='SP-01') ensureWaterCols(sh,sheetName);
      ensureUpdatedAtCol(sh);
      var vals = sh.getDataRange().getValues();
      var shHeaders = vals[0].map(function(h){ return String(h).trim(); });
      var rowIdx = -1;
      for (var i=1;i<vals.length;i++) { if (String(vals[i][0])===String(id)){rowIdx=i+1;break;} }
      if (rowIdx<0) return ok('ID not found: '+id);
      if (sheetName==='MX-01') {
        var schema11 = SCHEMA['MX-01'];
        shHeaders.forEach(function(h,colIdx){
          if (schema11.indexOf(h)<0&&h) sh.getRange(rowIdx,colIdx+1).clearContent();
        });
      }
      var row = buildRow(sheetName,payload,shHeaders);
      if (!row.length) return ok('empty row');
      sh.getRange(rowIdx,1,1,row.length).setValues([row]);
      if (sheetName==='MX-01'&&payload.allChems) appendChemicals(sh,rowIdx,payload.allChems);
      if (sheetName==='MX-01') { try { updateMXStages(); } catch(e) {} }
      if (sheetName==='SP-01') updateSPSummary();
      return ok('updated '+id);
    }

    if (action === 'appendMany') {
      var sheets  = payload.sheets || {};
      var counts  = {};
      var deletedSet = {};
      getDeletedIds().forEach(function(id){ deletedSet[id]=true; });
      Object.keys(sheets).forEach(function(name){
        if (!SCHEMA[name]) return;
        var sh = ensureSheet(name);
        if (name==='MX-01'||name==='SP-01') ensureWaterCols(sh,name);
        ensureUpdatedAtCol(sh);
        var rows = sh.getDataRange().getValues();
        var headers = rows[0].map(function(h){ return String(h).trim(); });
        var idxUpdatedAt = headers.indexOf('UpdatedAt');
        var existingIds  = rows.slice(1).map(function(r){ return String(r[0]); });
        var added=0, updated=0;
        var isMX = (name==='MX-01');
        var mxHeaders = isMX ? headers : null;
        (sheets[name]||[]).forEach(function(d){
          if (!d.id) return;
          if (deletedSet[String(d.id)]) return;
          var existIdx = existingIds.indexOf(String(d.id));
          if (existIdx >= 0) {
            var rowIdx = existIdx+2;
            // เทียบเวลาด้วย epoch ms (ผ่าน tsMs) — ตัดปัญหา format/timezone ปนกันที่ทำให้ string compare เพี้ยน
            var existingMs = (idxUpdatedAt>=0) ? tsMs(rows[existIdx+1][idxUpdatedAt]) : 0;
            var incomingMs = tsMs(d.updatedAt);
            // กัน bounce: ถ้าแถวบน sheet ยังไม่มี UpdatedAt (เก่า) → backfill timestamp (ISO UTC) แล้ว "ไม่" overwrite รอบนี้
            // (sheet คือค่าที่ถูก write ล่าสุด, ไม่ปล่อยให้ push ค่าเก่ามาทับ — การแก้จริงใช้ action update เสมอ)
            if (idxUpdatedAt>=0 && existingMs===0) {
              var backfillMs = incomingMs || tsMs(d.createdAt) || Date.now();
              sh.getRange(rowIdx, idxUpdatedAt+1).setValue(new Date(backfillMs).toISOString());
              existingMs = backfillMs;
            }
            // overwrite เฉพาะเมื่อ "ทั้งสองฝั่งมี timestamp" และ incoming ใหม่กว่าจริง
            var shouldUpdate = (incomingMs>0 && existingMs>0 && incomingMs>existingMs);
            // incoming ไม่เก่ากว่า sheet → อนุญาตให้เติม cell ว่างได้ (กันเครื่องเก่าเติมค่าที่ลบไปแล้วกลับมา)
            var incomingNotOlder = (existingMs===0 || incomingMs===0 || incomingMs>=existingMs);
            if (shouldUpdate) {
              var row = buildRow(name,d,headers);
              if (row.length){ sh.getRange(rowIdx,1,1,row.length).setValues([row]); updated++; }
              if (isMX&&d.allChems&&Object.keys(d.allChems).length>0) appendChemicals(sh,rowIdx,d.allChems);
            }
            if (name==='SP-01'&&!shouldUpdate&&incomingNotOlder) {
              var spRowVals = sh.getRange(rowIdx,1,1,sh.getLastColumn()).getValues()[0];
              [['WaterBefore',d.waterBefore],['WaterAfter',d.waterAfter],['WaterUsed',d.waterUsed],['MxId',d.mxId]].forEach(function(sf){
                var sCol=headers.indexOf(sf[0]); if(sCol<0) return;
                var curS=String(spRowVals[sCol]).trim();
                var incoming=sf[0]==='MxId'?String(sf[1]||''):(parseFloat(sf[1])>0?parseFloat(sf[1]):'');
                if((!curS||curS==='0')&&incoming!=='') sh.getRange(rowIdx,sCol+1).setValue(incoming);
              });
              var cdCol=headers.indexOf('ChemDelivered');
              if(cdCol>=0&&d.chemDelivered&&Object.keys(d.chemDelivered).length>0){
                var curCD=String(spRowVals[cdCol]).trim();
                if(!curCD||curCD==='{}') sh.getRange(rowIdx,cdCol+1).setValue(JSON.stringify(d.chemDelivered));
              }
            }
            if (isMX&&!shouldUpdate&&incomingNotOlder) {
              var rowVals=sh.getRange(rowIdx,1,1,sh.getLastColumn()).getValues()[0];
              [['TotalWater',d.totalWater],['WaterPerTank',d.waterPerTank]].forEach(function(wf){
                var wCol=mxHeaders.indexOf(wf[0]);
                if(wCol<0||!(parseFloat(wf[1])>0)) return;
                if(!(parseFloat(rowVals[wCol])>0)) sh.getRange(rowIdx,wCol+1).setValue(parseFloat(wf[1]));
              });
            }
            if (isMX&&d.allChems&&Object.keys(d.allChems).length>0&&(shouldUpdate||incomingNotOlder)) {
              var targetRow=sh.getRange(rowIdx,1,1,sh.getLastColumn()).getValues()[0];
              Object.keys(d.allChems).forEach(function(chemName){
                var colIdx=mxHeaders.indexOf(chemName); if(colIdx<0) return;
                var current=String(targetRow[colIdx]).trim();
                if(!current||current==='0') sh.getRange(rowIdx,colIdx+1).setValue(parseFloat(d.allChems[chemName])||0);
              });
            }
            return;
          }
          var row = buildRow(name,d,headers);
          if (row.length) {
            sh.appendRow(row); added++;
            existingIds.push(String(d.id));
            if (isMX&&d.allChems) appendChemicals(sh,sh.getLastRow(),d.allChems);
          }
        });
        counts[name] = added;
        if (name==='SP-01'&&(added>0||updated>0)) updateSPSummary();
      });
      // ★ อัพเดท CR_Issued + CalcQty ใน STOCK_INIT ทุกครั้งที่ sync
      try { updateStockInitCalc(); } catch(e) {}
      // ★ อัพเดท column Stage ใน MX-01 (Burn down/Pre-em = D0)
      if (sheets['MX-01']) { try { updateMXStages(); } catch(e) {} }
      return ok(JSON.stringify(counts));
    }

    return ok('unknown action: '+action);
  } catch(err) {
    return ok('error: '+err.message);
  }
}

function ok(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
