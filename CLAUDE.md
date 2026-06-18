# Sprayer App — Mega Farm Cambodia

## แอพพลิเคชัน
- **URL**: https://atomnet16.github.io/Jirayu/
- **Repo**: github.com/atomnet16/Jirayu
- **ไฟล์หลัก**: `C:\Users\Admin\Jirayu\index.html` (Single-file PWA, vanilla JS, ~2400 lines)
- **ภาษา**: ตอบเป็นภาษาไทยเสมอ

## Google Sheet Backend
- **ไฟล์**: Chemical Control Records - Mega Farm
- **Sheet ID**: `1j3KleOE--ZOJjK3I9PyXkyQj5_NJ3oQdJYzRmuzMKQU`
- **GAS SCRIPT_URL**: `https://script.google.com/macros/s/AKfycbw-hyf7Qbz0Wsk-J8d1eY_13qVtcbAAGDLQ27RLN9dzSfY9ETxzRBtR1fUOJiL4mb0/exec`

## Tab ใน Sheet
| Tab | ข้อมูล |
|-----|--------|
| CR-01 | เบิกสารเคมี |
| MX-01 | Mix สารเคมี |
| SP-01 | ฉีดพ่น |
| ST-01 | รับสต๊อก |
| RT-01 | คืนสาร |
| STOCK_INIT | ปริมาณตั้งต้น (แก้ได้ใน Sheet) |
| DELETED | ID ที่ลบแล้ว |

## ระบบ STOCK_INIT
- คอลัมน์ที่ผู้ปฏิบัติกรอก: **C SnapQty**, **D SnapDate**, **G PhysCount**
- ระบบคำนวณเอง: E CR_Issued, F CalcQty, H Variance (=G-F)
- Fallback: ถ้า Sheet ว่าง → ใช้ `CHEMS[].s` + `WAREHOUSE_START` ใน index.html
- CR ก่อน SnapDate ไม่ถูกนับซ้ำ (รวมอยู่ใน SnapQty แล้ว) แต่ยังแสดงใน History

## UI Theme — Limestone
```
--bg: #EBE5D8
--surf: #F6F2E8
--card: #F0EDE4
--bdr: #C6C0B2
--acc: #2C4E38
```

## GAS Functions สำคัญ
- `doGet` → action=getAll ส่ง stockInit กลับด้วย
- `doPost` → appendMany เรียก updateStockInitCalc() ทุกครั้ง
- `seedStockInit()` → รันครั้งเดียวเพื่อสร้าง Tab STOCK_INIT (46 สารเคมี)
- `updateStockInitCalc()` → คำนวณ CR_Issued + CalcQty อัตโนมัติ

## ข้อควรระวัง
- PWA มี Service Worker cache — ผู้ใช้ต้อง clear cache หลัง deploy
- ฟอร์ม CR, ST, RT, MX, SP ห้ามเปลี่ยน UI
- แก้ยอดสต๊อก = แก้ Sheet STOCK_INIT (C, D) ไม่ใช่แก้ index.html
