// ═══════════════════════════════════════════════════════════════════
//  STOCK_INIT — ปริมาณตั้งต้นจาก Sheet (แก้ได้ทุกรอบนับสต๊อก)
//  วางโค้ดนี้ต่อท้าย Code.gs ของ Sprayer App (Chem Control)
//  แล้วทำ 3 จุดแก้เล็กน้อยตามหมายเหตุ "★ EDIT" ด้านล่างสุด
//
//  โครงสร้าง Sheet "STOCK_INIT" (9 คอลัมน์):
//    A Chemical | B Unit | C SnapQty | D SnapDate
//    E CR_Issued (auto) | F CalcQty (auto) | G PhysCount | H Variance (formula) | I CountDate
//  ผู้ปฏิบัติกรอกแค่:  C SnapQty · D SnapDate · G PhysCount
//  ระบบคำนวณเอง:       E CR_Issued · F CalcQty · H Variance
// ═══════════════════════════════════════════════════════════════════

var STOCK_INIT_SHEET = 'STOCK_INIT';

// ── อ่าน STOCK_INIT ส่งให้แอพ (เฉพาะ A–D ที่แอพต้องใช้) ──────────────
function getStockInit() {
  var sh = SS.getSheetByName(STOCK_INIT_SHEET);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var tz = Session.getScriptTimeZone();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var chem = String(r[0] || '').trim();
    if (!chem) continue;
    var sd = r[3];
    if (sd instanceof Date && !isNaN(sd)) sd = Utilities.formatDate(sd, tz, 'yyyy-MM-dd');
    else sd = String(sd || '').substring(0, 10);
    out.push({
      chemical: chem,
      unit:     String(r[1] || '').trim(),
      snapQty:  parseFloat(r[2]) || 0,
      snapDate: sd
    });
  }
  return out;
}

// ── คำนวณ E (CR_Issued) + F (CalcQty) จากประวัติ CR-01 แล้วเขียนกลับ Sheet ──
// นับเฉพาะ CR ที่วันที่ >= SnapDate ของสารนั้น (สอดคล้องกับแอพ)
function updateStockInitCalc() {
  var sh = SS.getSheetByName(STOCK_INIT_SHEET);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var tz = Session.getScriptTimeZone();

  // รวบรวม CR-01 ทุกรายการ → [{date, chems:[{n,q}]}]
  var crSh = SS.getSheetByName('CR-01');
  var crRows = crSh ? crSh.getDataRange().getValues() : [];
  var crList = [];
  if (crRows.length > 1) {
    var h = crRows[0].map(function(x){ return String(x).trim(); });
    var iDate = h.indexOf('Date');
    var iChem = h.indexOf('Chemicals'); if (iChem < 0) iChem = h.indexOf('Note');
    for (var i = 1; i < crRows.length; i++) {
      var rr = crRows[i];
      var d = rr[iDate];
      if (d instanceof Date && !isNaN(d)) d = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      else d = String(d || '').substring(0, 10);
      var chems = [];
      try { var p = JSON.parse(rr[iChem]); if (Array.isArray(p)) chems = p; } catch(e) {}
      crList.push({ date: d, chems: chems });
    }
  }

  // เขียน E, F ทีละแถว
  for (var j = 1; j < data.length; j++) {
    var chem = String(data[j][0] || '').trim();
    if (!chem) continue;
    var snapQty = parseFloat(data[j][2]) || 0;
    var sd = data[j][3];
    if (sd instanceof Date && !isNaN(sd)) sd = Utilities.formatDate(sd, tz, 'yyyy-MM-dd');
    else sd = String(sd || '').substring(0, 10);

    var issued = 0;
    crList.forEach(function(cr) {
      if (sd && cr.date && cr.date < sd) return;
      cr.chems.forEach(function(c) {
        if (String(c.n).trim() === chem) issued += parseFloat(c.q) || 0;
      });
    });
    sh.getRange(j + 1, 5).setValue(issued);            // E CR_Issued
    sh.getRange(j + 1, 6).setValue(snapQty - issued);  // F CalcQty
  }
}

// ── สร้าง Sheet STOCK_INIT + seed รายชื่อสารเคมี (รันครั้งเดียวจากเมนู Run) ──
// ค่าตั้งต้นตรงกับ CHEMS[].s ใน index.html ณ 2026-06-14 → เริ่มมาเหมือนระบบเดิมเป๊ะ
function seedStockInit() {
  var ss = SS;
  var sh = ss.getSheetByName(STOCK_INIT_SHEET);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(STOCK_INIT_SHEET);

  var hdr = ['Chemical','Unit','SnapQty','SnapDate','CR_Issued','CalcQty','PhysCount','Variance','CountDate'];
  sh.getRange(1,1,1,hdr.length).setValues([hdr])
    .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
  sh.setFrozenRows(1);

  var SEED = [
    ['Emamecthrin','Kg',216.5],['Belt','Kg',280.7],['Lufenuron','L',944],['Fipronil','L',0],
    ['Altacor','Kg',0],['Profenofos','L',783.5],['Actara (Thiamethoxam)','Kg',7.5],['Eforia','L',1745.5],
    ['Amrarar','Kg',0],['Spirotetramat','L',94.3],['Chlorfenapyr','L',1774],['Bifentrin (Talstar)','L',258],
    ['Methomyl','Kg',13],['Glyphosate','L',0],['Dual Gold','L',3639.5],['2,4-D','L',750],
    ['Clio Pro','L',124.4],['Atrazine','Kg',1797.9],['Nicosulfuron (Green)','L',113.65],['Nicosulfuron (Yellow)','L',37],
    ['Sumisoya','Kg',53.7],['Glufosinate','L',3873],['Pendimethalin','L',3879],['Acetochlor','L',640],
    ['Imazetapyr (Pursuit)','L',874.6],['Indaziflam (Becano)','L',19.3],['Metribuzin (Sencor)','Kg',162.25],
    ['Quizalofop (Clifton)','L',714],['Fomesafen (Flex)','L',112.75],['Fomesafen (Farma)','L',1912],
    ['Ametryn 80','Kg',145],['Fluazifop','L',2160],['Carbendazim','L',0.5],['Nativo','Kg',0.3],
    ['Atemis','L',1021],['Mammoth Zinc','L',35],['Mammoth Ca+B','L',100],['Surfactant','L',1123.15],
    ['K30','L',2461.8],['CoMo','L',200],['Levos','Kg',1145],['MgSO4','Kg',0],
    ['Euro seed','L',0],['Fergan','L',0],['Vetget oil','L',0],['Virtus','Kg',0]
  ];
  var SNAP_DATE = '2026-06-14';
  var rows = SEED.map(function(s){
    // A,B,C,D + E,F ว่าง (auto) + G,H,I ว่าง
    return [s[0], s[1], s[2], SNAP_DATE, '', '', '', '', ''];
  });
  sh.getRange(2,1,rows.length,9).setValues(rows);

  // H Variance = G − F (สูตรใน Sheet, คำนวณเมื่อกรอก G)
  for (var i = 0; i < rows.length; i++) {
    var r = i + 2;
    sh.getRange(r,8).setFormula('=IF(G'+r+'="","",G'+r+'-F'+r+')');
  }

  // จัดความกว้าง + รีเฟรช E,F
  sh.setColumnWidth(1,170); sh.setColumnWidth(4,100); sh.setColumnWidth(9,100);
  updateStockInitCalc();

  SpreadsheetApp.getUi && SpreadsheetApp.getActive().toast('STOCK_INIT seeded: '+rows.length+' chemicals');
}

// ═══════════════════════════════════════════════════════════════════
//  ★ EDIT — แก้ 2 จุดใน Code.gs เดิม
// ═══════════════════════════════════════════════════════════════════
//
//  จุดที่ 1 — ใน doGet() ที่ action === 'getAll'
//  เปลี่ยนบรรทัด return เดิม:
//      return jsonpOk(cb, { ok: true, data: result, deletedIds: getDeletedIds() });
//  เป็น:
//      return jsonpOk(cb, { ok: true, data: result, deletedIds: getDeletedIds(), stockInit: getStockInit() });
//
//  จุดที่ 2 — ใน doPost() ที่ action === 'appendMany' ก่อน "return ok(...)"
//  เพิ่ม 1 บรรทัด เพื่อรีเฟรช CR_Issued/CalcQty ทุกครั้งที่ CR เปลี่ยน:
//      try { updateStockInitCalc(); } catch(e) {}
//
//  ── ติดตั้งครั้งแรก ──
//  1) วางไฟล์นี้ใน Apps Script → Save
//  2) เลือกฟังก์ชัน seedStockInit → กด Run (อนุญาตสิทธิ์ครั้งแรก)
//  3) Deploy ทับ deployment เดิม (Manage deployments → Edit → New version)
//  4) เปิดแอพ → Sync → ตาราง STOCK ใช้ค่าจาก Sheet อัตโนมัติ
//
//  ── รอบนับสต๊อกถัดไป ──
//  แก้ใน Sheet STOCK_INIT:  C SnapQty = ยอดจริง · D SnapDate = วันที่นับ
//  (ถ้านับจริงอยากดูผลต่าง: กรอก G PhysCount → H โชว์ −หาย/+เกิน)
// ═══════════════════════════════════════════════════════════════════
