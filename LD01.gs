// ═══════════════════════════════════════════════════════════════════
//  LD-01 — ដាក់ថ្នាំលើឡាន (โหลดสารเคมีขึ้นรถ)
//
//  1 แถว = 1 ใบโหลดขึ้นรถ · สารเคมีเก็บเป็นคอลัมน์ (โครงเดียวกับ MX-01)
//  คงเหลือบนรถ = Σ LD-01 − Σ MX-01   (แอปคำนวณฝั่ง client)
//
//  ไฟล์นี้ตั้งใจให้แตะ Code.gs น้อยที่สุด — SCHEMA ลงทะเบียนเองจากตรงนี้
//  ใน Code.gs จึงเพิ่มแค่ 5 บรรทัด และเป็นการ "เพิ่ม" ล้วน ไม่แก้บรรทัดเดิม
//
//  ลำดับใช้งาน:
//    1) ld01CheckSchema()  — ต้องได้ true ก่อน ไม่งั้นย้ายไฟล์นี้ลงล่างสุดใน sidebar
//    2) ld01SetupSheet()   — สร้าง/ซ่อมหัวคอลัมน์ (รันซ้ำได้ ไม่แตะข้อมูลเดิม)
//    3) ld01TestAll()      — ทดสอบทั้งเส้นโดยไม่ต้อง deploy แล้วลบแถวทดสอบทิ้ง
// ═══════════════════════════════════════════════════════════════════

// ▶ กด Run ที่ฟังก์ชันนี้ (ตัวแรกของไฟล์ = ตัวที่ editor เลือกให้เอง)
//   ทำครบในคลิกเดียว: ตรวจ SCHEMA → สร้าง/ซ่อมชีต → ทดสอบ → ลบแถวทดสอบ
function RUN_LD01() {
  var out = [];
  out.push(ld01CheckSchema() ? 'T1 PASS · SCHEMA รู้จัก LD-01' : 'T1 FAIL · SCHEMA ไม่รู้จัก LD-01');
  try { out.push('setup · ' + ld01SetupSheet()); }
  catch (e) { out.push('setup FAIL · ' + e.message); Logger.log(out.join('\n')); return out.join('\n'); }
  out.push(ld01TestAll());
  out.push(ld01TestMX());
  out.push(ld01Cleanup());   // เก็บกวาดแถว MX ที่เทสต์ regression สร้างไว้
  var res = out.join('\n');
  Logger.log('════════ สรุป RUN_LD01 ════════\n' + res);
  return res;
}

var LD01_SHEET = 'LD-01';

// คอลัมน์ meta — ห้ามใส่ชื่อสารตรงนี้ (ใช้เป็น gate ของ doGet/doPost เท่านั้น
// ส่วน layout จริงยึดหัวคอลัมน์ของชีต เพราะ buildRow วนตาม shHeaders)
var LD01_META = ['ID','Date','Time','LoadedBy','Truck','Season','Note','CreatedAt','UpdatedAt'];

// รายชื่อสารไว้ cross-check กับหัวคอลัมน์ MX-01 (ตรงกับ CHEMS[].n ในแอป)
var LD01_CHEMS = [
  'Emamecthrin','Belt','Lufenuron','Fipronil','Altacor','Profenofos','Actara (Thiamethoxam)','Eforia',
  'Amrarar','Spirotetramat','Chlorfenapyr','Bifentrin (Talstar)','Methomyl','Glyphosate','Dual Gold',
  '2,4-D','Clio Pro','Atrazine','Nicosulfuron (Green)','Nicosulfuron (Yellow)','Sumisoya','Glufosinate',
  'Pendimethalin','Acetochlor','Imazetapyr (Pursuit)','Indaziflam (Becano)','Metribuzin (Sencor)',
  'Quizalofop (Clifton)','Fomesafen (Flex)','Fomesafen (Farma)','Ametryn 80','Fluazifop','Carbendazim',
  'Nativo','Atemis','Mammoth Zinc','Mammoth Ca+B','Surfactant','K30','CoMo','Levos','MgSO4','Euro seed',
  'Fergan','Vetget oil','Virtus','NEWGREEN','Urea','Aquacon','Reflect','Eysan','Vayego','Antracol'
];

// ── ลงทะเบียน SCHEMA (top-level — ทำงานก่อน doGet/doPost ทุกครั้ง) ──
// ปิดประตู 4 บานรวดเดียว: doGet filter, append gate, appendMany gate, doUpdate gate
(function () {
  if (typeof SCHEMA !== 'undefined' && SCHEMA) SCHEMA[LD01_SHEET] = LD01_META;
})();

function ld01CheckSchema() {
  var okNow = (typeof SCHEMA !== 'undefined' && !!SCHEMA[LD01_SHEET]);
  Logger.log('SCHEMA["' + LD01_SHEET + '"] = ' + (okNow ? JSON.stringify(SCHEMA[LD01_SHEET]) : 'ไม่มี — ย้ายไฟล์นี้ลงล่างสุดใน sidebar'));
  return okNow;
}

// ═══ หัวคอลัมน์ ════════════════════════════════════════════════════

// ชื่อสารเอาจากหัวคอลัมน์ MX-01 ของจริง (ช่วงหลัง CreatedAt ถึงก่อน UpdatedAt)
// MX-01 ใช้งานจริงอยู่แล้ว การคัดลอกมาจึงรับประกันว่าสะกดตรงกับที่ appendChemicals จับคู่ได้
function ld01ChemsFromMX_() {
  var mx = SS.getSheetByName('MX-01');
  if (!mx) throw new Error('ไม่พบชีต MX-01 — ยกเลิก');
  var h = mx.getRange(1, 1, 1, mx.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
  var a = h.indexOf('CreatedAt'), b = h.indexOf('UpdatedAt');
  if (a < 0 || b < 0 || b <= a) throw new Error('หา CreatedAt/UpdatedAt ใน MX-01 ไม่เจอ — หัวคอลัมน์อาจถูกแก้');
  return h.slice(a + 1, b).filter(String);
}

// สร้าง / ซ่อมหัวคอลัมน์ · รันซ้ำได้ ไม่ลบ ไม่เรียงใหม่ ไม่แตะข้อมูลแถว 2 เป็นต้นไป
function ld01SetupSheet(force) {
  var chems = ld01ChemsFromMX_();
  var miss  = LD01_CHEMS.filter(function (n) { return chems.indexOf(n) < 0; });
  var extra = chems.filter(function (n) { return LD01_CHEMS.indexOf(n) < 0; });
  Logger.log('MX-01 มีสาร ' + chems.length + ' ตัว · ขาดจากรายการอ้างอิง: ' + (miss.join(', ') || '-') + ' · เกินมา: ' + (extra.join(', ') || '-'));
  if ((miss.length || extra.length) && !force) {
    throw new Error('หัวคอลัมน์ MX-01 ไม่ตรงกับ LD01_CHEMS — ตรวจก่อน หรือเรียก ld01SetupSheet(true) ถ้าตั้งใจ');
  }

  var want = LD01_META.slice(0, -1).concat(chems).concat(['UpdatedAt']);  // meta → สาร → UpdatedAt (เลียน MX-01)
  var sh = SS.getSheetByName(LD01_SHEET);
  var msg;

  if (!sh) {
    sh = SS.insertSheet(LD01_SHEET);
    sh.getRange(1, 1, 1, want.length).setValues([want])
      .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 95); sh.setColumnWidth(2, 88);
    sh.setColumnWidth(4, 92); sh.setColumnWidth(5, 92);
    sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
    var firstChem = want.indexOf(chems[0]) + 1;
    sh.getRange(2, firstChem, sh.getMaxRows() - 1, chems.length).setNumberFormat('0.###');
    msg = 'สร้างชีต ' + LD01_SHEET + ' · ' + want.length + ' คอลัมน์ (meta ' + (want.length - chems.length) + ' + สาร ' + chems.length + ')';
  } else {
    var lastCol = Math.max(sh.getLastColumn(), 1);
    var cur = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
    var have = {};
    cur.forEach(function (h) { if (h) have[h] = 1; });
    var add = want.filter(function (h) { return !have[h]; });
    if (add.length) {
      sh.getRange(1, lastCol + 1, 1, add.length).setValues([add])
        .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
      msg = 'เติมคอลัมน์ที่ขาด ' + add.length + ' ช่อง: ' + add.join(', ');
    } else {
      msg = 'หัวคอลัมน์ครบแล้ว (' + cur.filter(String).length + ' ช่อง) — ไม่มีอะไรต้องแก้';
    }
  }
  Logger.log(msg);
  try { SpreadsheetApp.getActive().toast(msg, 'ld01SetupSheet', 8); } catch (e) {}
  return msg;
}

// ถ้าคอลัมน์สารตัวไหนหาย → งอกคืนต่อท้าย กันเคส "สารหายเงียบ"
// (เช่น ชีตถูกสร้างโดย ensureSheet ซึ่งรู้จักแค่ meta 9 คอลัมน์)
function ld01EnsureChemCols(sh, allChems) {
  if (!allChems) return;
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var cur = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
  function norm(s) { return String(s).replace(/\s*\([A-Za-z]+\)\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  var have = {};
  cur.forEach(function (h) { if (h) { have[h] = 1; have[norm(h)] = 1; } });
  var add = Object.keys(allChems).filter(function (n) {
    return n && !have[n] && !have[norm(n)] && parseFloat(allChems[n]) > 0;
  });
  if (!add.length) return;
  sh.getRange(1, lastCol + 1, 1, add.length).setValues([add])
    .setBackground('#1a3d26').setFontColor('#3DDB72').setFontWeight('bold');
  Logger.log('ld01EnsureChemCols: งอกคอลัมน์ที่หาย ' + add.length + ' ช่อง → ' + add.join(', '));
}

// ── ตัวที่ Code.gs เรียก ────────────────────────────────────────────
function ld01AppendChems(sh, rowNum, allChems) {
  ld01EnsureChemCols(sh, allChems);
  appendChemicals(sh, rowNum, allChems);   // ใช้ของ Code.gs ไม่เขียนซ้ำ
}

// เติมเฉพาะเซลล์ที่ยังว่าง (self-heal แถวที่เข้าชีตก่อนมีคอลัมน์สาร)
function ld01FillEmptyChems(sh, rowNum, allChems) {
  if (!allChems) return;
  ld01EnsureChemCols(sh, allChems);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
  Object.keys(allChems).forEach(function (n) {
    var v = parseFloat(allChems[n]);
    if (isNaN(v) || v <= 0) return;
    var c = headers.indexOf(n);
    if (c < 0) return;
    var cell = sh.getRange(rowNum, c + 1);
    var old = parseFloat(cell.getValue());
    if (!(old > 0)) cell.setValue(v);
  });
}

// ═══ ชุดทดสอบ — ยิงผ่าน doGet/doPost ตัวจริงโดยไม่ต้อง deploy ═══════

var LD01_TEST_PREFIX = 'ZZTEST-';

function ld01Post_(p) { return doPost({ postData: { contents: JSON.stringify(p) } }).getContent(); }
function ld01Get_(q)  { return doGet({ parameter: q }).getContent(); }

function ld01Rows_(sh) {
  var v = sh.getDataRange().getValues();
  return { headers: v[0].map(function (h) { return String(h).trim(); }), body: v.slice(1) };
}
function ld01Find_(sh, id) {
  var r = ld01Rows_(sh);
  for (var i = 0; i < r.body.length; i++) {
    if (String(r.body[i][0]).trim() === id) return { idx: i + 2, row: r.body[i], headers: r.headers };
  }
  return null;
}

function ld01TestAll() {
  var R = [];
  function check(name, cond, detail) {
    R.push((cond ? 'PASS' : 'FAIL') + ' · ' + name + (detail ? '  → ' + detail : ''));
  }
  var sh = SS.getSheetByName(LD01_SHEET);
  if (!sh) { Logger.log('FAIL · ยังไม่มีชีต ' + LD01_SHEET + ' — รัน ld01SetupSheet() ก่อน'); return; }

  try {
    // T1 — SCHEMA ถูกลงทะเบียนจากไฟล์นี้จริง
    check('T1 SCHEMA รู้จัก ' + LD01_SHEET, ld01CheckSchema());

    // T2 — setup idempotent
    ld01SetupSheet();
    var cols1 = ld01Rows_(sh).headers.filter(String).length;
    ld01SetupSheet();
    var cols2 = ld01Rows_(sh).headers.filter(String).length;
    check('T2 setup รันซ้ำแล้วคอลัมน์ไม่งอก', cols1 === cols2, cols1 + ' → ' + cols2);

    // T3 — append + ค่าเกิน 2000 + ชื่อสารมั่ว
    var id1 = LD01_TEST_PREFIX + 'LD1';
    ld01Post_({ action: 'append', sheet: LD01_SHEET, id: id1, date: '2026-10-07', time: '08:30',
      loadedBy: 'ZZTest', truck: 'Cricket', season: 'Rain Season / 26', note: 'unit test',
      allChems: { 'Atrazine': 2500, 'Surfactant': 12.5, 'ไม่มีสารนี้จริง': 9 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    var f1 = ld01Find_(sh, id1);
    check('T3 append สร้างแถวได้', !!f1);
    if (f1) {
      var col = function (n) { var i = f1.headers.indexOf(n); return i < 0 ? undefined : f1.row[i]; };
      check('T3 LoadedBy ลงถูกช่อง', String(col('LoadedBy')) === 'ZZTest', String(col('LoadedBy')));
      check('T3 Truck ลงถูกช่อง', String(col('Truck')) === 'Cricket', String(col('Truck')));
      check('T3 Season ลงถูกช่อง', String(col('Season')) === 'Rain Season / 26', String(col('Season')));
      check('T3 สารค่า 2500 ไม่ถูกตัด (backend ไม่มีเพดาน)', Number(col('Atrazine')) === 2500, String(col('Atrazine')));
      check('T3 สารทศนิยม 12.5', Number(col('Surfactant')) === 12.5, String(col('Surfactant')));
      check('T3 UpdatedAt ไม่ว่าง', !!String(col('UpdatedAt') || '').trim());
    }

    // T4 — append id ซ้ำต้องไม่เพิ่มแถว
    var before = ld01Rows_(sh).body.length;
    ld01Post_({ action: 'append', sheet: LD01_SHEET, id: id1, date: '2026-10-07',
      loadedBy: 'ZZTest-DUP', allChems: { 'Atrazine': 999 }, createdAt: new Date().toISOString() });
    check('T4 append id ซ้ำไม่เพิ่มแถว', ld01Rows_(sh).body.length === before);

    // T5 — appendMany 2 ใบใหม่ + 1 ใบซ้ำ
    var id2 = LD01_TEST_PREFIX + 'LD2', id3 = LD01_TEST_PREFIX + 'LD3';
    var sheets = {};
    sheets[LD01_SHEET] = [
      { id: id2, date: '2026-10-07', time: '09:00', loadedBy: 'ZZTest', truck: 'P-Mantis',
        season: 'Rain Season / 26', allChems: { 'Emamecthrin': 30 },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: id3, date: '2026-10-07', time: '09:30', loadedBy: 'ZZTest', truck: '',
        season: 'Rain Season / 26', allChems: { 'Glyphosate': 40, 'Atrazine': 15 },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: id1, date: '2026-10-07', loadedBy: 'ZZTest-DUP2', allChems: { 'Atrazine': 1 },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    var n0 = ld01Rows_(sh).body.length;
    ld01Post_({ action: 'appendMany', sheets: sheets });
    var n1 = ld01Rows_(sh).body.length;
    check('T5 appendMany เพิ่ม 2 แถว (ใบซ้ำถูกข้าม)', n1 - n0 === 2, (n1 - n0) + ' แถว');
    var f3 = ld01Find_(sh, id3);
    if (f3) {
      var g = function (n) { var i = f3.headers.indexOf(n); return i < 0 ? undefined : f3.row[i]; };
      check('T5 appendMany เขียนสาร Glyphosate=40', Number(g('Glyphosate')) === 40, String(g('Glyphosate')));
      check('T5 appendMany เขียนสาร Atrazine=15', Number(g('Atrazine')) === 15, String(g('Atrazine')));
    }

    // T6 — update: แก้ปริมาณ + ตัดสารออก 1 ตัว (เคสที่พลาดง่ายสุด)
    var beforeUpd = ld01Find_(sh, id1);
    var oldUpdatedAt = beforeUpd ? String(beforeUpd.row[beforeUpd.headers.indexOf('UpdatedAt')]) : '';
    Utilities.sleep(1200);
    ld01Post_({ action: 'update', sheet: LD01_SHEET, id: id1, date: '2026-10-07', time: '08:30',
      loadedBy: 'ZZTest', truck: 'Cricket', season: 'Rain Season / 26', note: 'updated',
      allChems: { 'Atrazine': 77 },   // ตัด Surfactant ออก
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    var f1b = ld01Find_(sh, id1);
    if (f1b) {
      var c2 = function (n) { var i = f1b.headers.indexOf(n); return i < 0 ? undefined : f1b.row[i]; };
      check('T6 update แก้ปริมาณได้ (Atrazine=77)', Number(c2('Atrazine')) === 77, String(c2('Atrazine')));
      check('T6 update สารที่ถูกตัดออกกลายเป็นว่าง', !String(c2('Surfactant') || '').trim(), 'Surfactant="' + c2('Surfactant') + '"');
      check('T6 update เปลี่ยน UpdatedAt', String(c2('UpdatedAt')) !== oldUpdatedAt);
      check('T6 update ไม่ทำ Truck หาย', String(c2('Truck')) === 'Cricket', String(c2('Truck')));
    }

    // T7 — doGet อ่านกลับได้ และ key สารครบ
    var got = ld01Get_({ action: 'getAll', sheets: 'MX-01,' + LD01_SHEET, callback: 'cb' });
    check('T7 doGet คืนชีต ' + LD01_SHEET, got.indexOf(id2) >= 0);
    check('T7 doGet ยังคืน MX-01 ด้วย', got.indexOf('"MX-01"') >= 0);
    var gotSolo = ld01Get_({ action: 'getAll', sheets: LD01_SHEET, callback: 'cb' });
    check('T8 doGet ขอ LD-01 เดี่ยวไม่ถูก filter ทิ้ง', gotSolo.indexOf(id2) >= 0);

    // T9 — delete ผ่าน doGet
    ld01Get_({ action: 'delete', sheet: LD01_SHEET, id: id2, callback: 'cb' });
    check('T9 delete ลบแถวออกจากชีต', !ld01Find_(sh, id2));

  } catch (err) {
    R.push('FAIL · ระเบิดกลางทาง — ' + err.message);
  } finally {
    R.push(ld01Cleanup());
  }

  var out = R.join('\n');
  Logger.log(out);
  var fails = R.filter(function (x) { return x.indexOf('FAIL') === 0; }).length;
  try {
    SpreadsheetApp.getActive().toast(fails ? ('ไม่ผ่าน ' + fails + ' เคส — ดู Execution log') : 'ผ่านทุกเคส', 'ld01TestAll', 10);
  } catch (e) {}
  return out;
}

// ═══ MX regression — เส้นทางที่คนงานใช้จริงต้องไม่พังจากการแก้ Code.gs ═══
function ld01TestMX() {
  var R = [];
  function check(name, cond, detail) { R.push((cond ? 'PASS' : 'FAIL') + ' · ' + name + (detail ? '  → ' + detail : '')); }
  var sh = SS.getSheetByName('MX-01');
  if (!sh) { return 'FAIL · ไม่พบ MX-01'; }
  var id = LD01_TEST_PREFIX + 'MX1';
  try {
    ld01Post_({ action: 'append', sheet: 'MX-01', id: id, date: '2026-10-07', time: '07:15',
      mixer: 'ZZTest', plot: 'Mango 3', sprayer: 'Cricket', waterPerTank: 1000, totalWater: 2000,
      allChems: { 'Atrazine': 15, 'Surfactant': 2.25 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    var f = ld01Find_(sh, id);
    check('MX append สร้างแถวได้', !!f);
    if (f) {
      var c = function (n) { var i = f.headers.indexOf(n); return i < 0 ? undefined : f.row[i]; };
      check('MX สารลงคอลัมน์ (Atrazine=15)', Number(c('Atrazine')) === 15, String(c('Atrazine')));
      check('MX สารตัวที่สอง (Surfactant=2.25)', Number(c('Surfactant')) === 2.25, String(c('Surfactant')));
      check('MX Mixer/Plot/Sprayer ครบ',
        String(c('Mixer')) === 'ZZTest' && String(c('Plot')) === 'Mango 3' && String(c('Sprayer')) === 'Cricket');
      check('MX Total Water(L) ลงถูก', Number(c('Total Water(L)')) === 2000, String(c('Total Water(L)')));
      check('MX Stage ถูกคำนวณให้ (updateMXStages ไม่พัง)', String(c('Stage') || '').trim() !== '', String(c('Stage')));
      check('MX TankNo ถูกคำนวณให้ (updateMXTankNo ไม่พัง)', String(c('TankNo') || '').trim() !== '', String(c('TankNo')));
    }
    // update MX: ตัดสารออก 1 ตัว ต้องกลายเป็นว่าง (พฤติกรรมเดิมของ MX)
    ld01Post_({ action: 'update', sheet: 'MX-01', id: id, date: '2026-10-07', time: '07:15',
      mixer: 'ZZTest', plot: 'Mango 3', sprayer: 'Cricket', waterPerTank: 1000, totalWater: 2000,
      allChems: { 'Atrazine': 20 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    var f2 = ld01Find_(sh, id);
    if (f2) {
      var c2 = function (n) { var i = f2.headers.indexOf(n); return i < 0 ? undefined : f2.row[i]; };
      check('MX update แก้ปริมาณได้ (Atrazine=20)', Number(c2('Atrazine')) === 20, String(c2('Atrazine')));
      check('MX update สารที่ตัดออกกลายเป็นว่าง', !String(c2('Surfactant') || '').trim(), 'Surfactant="' + c2('Surfactant') + '"');
    }
  } catch (err) {
    R.push('FAIL · MX regression ระเบิด — ' + err.message);
  }
  return R.join('\n');
}

// ลบขยะทดสอบออกจาก LD-01, MX-01 และ DELETED (ลบจากล่างขึ้นบนเสมอ)
function ld01Cleanup() {
  var removed = 0;
  ['LD-01', 'MX-01', 'DELETED'].forEach(function (name) {
    var sh = SS.getSheetByName(name);
    if (!sh) return;
    var v = sh.getDataRange().getValues();
    for (var i = v.length - 1; i >= 1; i--) {
      if (String(v[i][0]).indexOf(LD01_TEST_PREFIX) === 0) { sh.deleteRow(i + 1); removed++; }
    }
  });
  var msg = 'cleanup · ลบแถวทดสอบ ' + removed + ' แถว (LD-01 + MX-01 + DELETED)';
  Logger.log(msg);
  return msg;
}
