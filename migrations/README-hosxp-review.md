# ตรวจสอบก่อนส่ง HOSxP

เปิด `/hosxp-review` จากเมนูด้านบนสำหรับ staff/admin แล้วกรอกรหัสผ่านบัญชีเดิมเพื่อยืนยันสิทธิ์ 30 นาที เลือกหมู่บ้าน ผลตรวจ หรือค้นชื่อ/เลขบัตร/รหัสบุคคล เทียบประเภทอยู่อาศัยและสถานะจำหน่าย แล้วเลือกรายการอนุมัติได้หน้าละ 25 รายการ

## ติดตั้ง

1. รัน `20260907_population_status.sql` ก่อน (ระบบนี้ดำเนินการแล้ว)
2. รัน `20260907_hosxp_review.sql` ผ่าน Supabase SQL Editor
3. `npm install` และนำเว็บเวอร์ชันใหม่ขึ้นใช้งาน
4. อ่านข้อมูลอ้างอิงจากเครื่องใน LAN ตามด้านล่าง

## อ่านข้อมูลอ้างอิงใหม่จาก LAN

ใช้ Node.js 20 ขึ้นไป ตั้งค่า `.env.sync` ที่รากโครงการบนเครื่องที่เข้าถึง HOSxP ได้ ห้ามใส่ service role key ในตัวแปร NEXT_PUBLIC หรือ commit ไฟล์นี้

```dotenv
HOSXP_DB_HOST=your-lan-server
HOSXP_DB_PORT=3306
HOSXP_DB_NAME=hosxp_pcu
HOSXP_DB_USER=read_only_user
HOSXP_DB_PASSWORD=your-local-password
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
```

```powershell
node scripts/refresh-hosxp-review.cjs
```

สคริปต์อ่าน HOSxP ด้วย SELECT ใน transaction แบบ read only แล้วส่งเฉพาะ person_id, cid, ประเภทอยู่อาศัย, สถานะจำหน่าย และ last_update ไปยังตารางอ้างอิงที่เปิด RLS ใน Supabase ไม่มีคำสั่งเขียน HOSxP ใช้ชุดใหม่เมื่ออัปโหลดและตรวจจำนวนครบเท่านั้น ชุดไม่ครบจะไม่แสดงหน้าเว็บ ชุดเก่ายังเก็บไว้เพื่ออ้างอิงประวัติการอนุมัติ

ต้องอ่านชุดใหม่ก่อนตรวจงานในแต่ละวัน ชุดเกิน 24 ชั่วโมงอนุมัติไม่ได้ ปุ่ม “โหลดรายการใหม่” อ่าน Supabase อีกครั้ง ไม่ได้เชื่อมเข้า LAN จากเบราว์เซอร์ หาก Supabase ปฏิเสธ key ให้ผู้ดูแลแก้ค่า service role ในไฟล์บนเครื่องโดยตรง ห้ามส่ง key ในแชท

## กติกาการตรวจ

- ตรวจเลขบัตร 13 หลักและ checksum; เลขบัตรซ้ำฝั่งใดฝั่งหนึ่งหรือรหัสบุคคลเดิมชี้ไปคนอื่นจะอนุมัติไม่ได้
- จับคู่เลขบัตรที่เป็นเอกลักษณ์ แล้วแสดงรหัสสำรวจและ person_id ปลายทาง รหัสทั้งสองต่างกันได้เมื่อไม่มีความขัดแย้ง
- แสดงเฉพาะค่าที่เปลี่ยนใน changes; ผู้เสียชีวิตที่เว้นประเภทอยู่อาศัยไว้ จะส่งเฉพาะสถานะจำหน่ายและคงประเภทเดิม
- ตรวจสิทธิ์ staff/admin และสถานะบัญชีที่ฐานข้อมูลทุกครั้ง ไม่ใช้ role จากเบราว์เซอร์เป็นหลักฐานอนุมัติ
- อนุมัติแบบทั้งชุดสำเร็จหรือยกเลิกทั้งหมด หากข้อมูลสำรวจหรือชุดอ้างอิงเปลี่ยน ให้ตรวจใหม่ ไม่อนุมัติซ้ำคำขอเดิม
- บันทึกผู้อนุมัติ เวลา ค่าเดิม ค่าที่เปลี่ยน ชุดอ้างอิง และ fingerprint ใน hosxp_review_approvals รายการเดิมถูกยกเลิกเมื่ออนุมัติรุ่นใหม่

## ขอบเขต

ฟีเจอร์นี้เป็นคิวอนุมัติ ยังไม่มีตัวส่งจริงเข้า HOSxP และยังไม่มีการเปลี่ยนข้อมูลใน HOSxP การสร้างตัวส่งภายหลังต้องตรวจ CID/person_id และค่าเดิมกับ HOSxP สดอีกครั้ง รวมทั้ง fingerprint กับข้อมูลสำรวจล่าสุด อย่านำ state='approved' เพียงอย่างเดียวไปส่ง เพราะข้อมูลอาจเปลี่ยนหลังอนุมัติ

ฐานข้อมูลใหม่ปิดการอ่านตารางตรงของ anon/authenticated ให้ใช้ RPC ที่มี review token เท่านั้น ระบบล็อกอินเดิมของแอปยังเป็น custom login; ฟีเจอร์นี้ไม่ได้เปลี่ยนเป็น Supabase Auth ทั้งระบบ

## ตัวส่งคิวอัตโนมัติฝั่ง LAN (เหมือนระบบพิกัดบ้าน)

1. **ติดตั้ง SQL Migration ใน Supabase SQL Editor**:
   - รัน `migrations/20261022_hosxp_review_dispatch.sql` (หากยังไม่เคยรัน)
   - รัน `migrations/20261117_hosxp_review_auto_send.sql` เพื่อเปิด RPC `hosxp_review_pending_queue` และแสดงสถานะ `เขียนเข้า HOSxP แล้ว (sent)` / `เครื่อง LAN กำลังส่ง (processing)` / `ต้องตรวจสอบ (failed)` บนหน้าเว็บ `/hosxp-review`
2. **สร้างตารางใบเสร็จใน MySQL HOSxP**:
   - รัน `scripts/hosxp-review-receipts.sql` ในฐานข้อมูล HOSxP (สร้างตาราง `survey_person_review_receipts` แบบ InnoDB เพื่อป้องกันการเขียนซ้ำ)
3. **เปิดใช้งานในไฟล์ `.env.sync` บนเครื่อง LAN**:
   ```dotenv
   HOSXP_REVIEW_WRITE_ENABLED=true
   ```
4. **คำสั่งรันด้วยมือ หรือตั้งเวลาอัตโนมัติ (Scheduled Task ทุก 1 นาที)**:
   - ดึง Snapshot ทะเบียนบุคคลจาก HOSxP ใหม่: `node scripts/hosxp-review-lan.cjs snapshot`
   - ส่งคิวเฉพาะรายการ: `node scripts/hosxp-review-lan.cjs send <approval-uuid>`
   - กู้คืนการแจ้งผลจากใบเสร็จ (กรณีเขียนสำเร็จแต่เน็ตหลุดก่อนแจ้งกลับ Supabase): `node scripts/hosxp-review-lan.cjs recover <approval-uuid>`
   - รันรอบอัตโนมัติ (ส่งครั้งละไม่เกิน 10 รายการที่อนุมัติแล้ว): `node scripts/hosxp-review-auto.cjs`
   - ติดตั้ง Windows Scheduled Task (`Nonsawang-Population-Review-Send`) ให้รันอัตโนมัติทุก 1 นาทีเหมือนคิวพิกัดบ้าน:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts/install-hosxp-review-auto.ps1
     ```

ทดสอบ: `node tests/hosxp-review-dispatch.cjs` (PostgreSQL semantics ผ่าน PGlite) และ `node tests/hosxp-review-writer-mysql.cjs` (MariaDB 127.0.0.1:33317 fixture เท่านั้น)
