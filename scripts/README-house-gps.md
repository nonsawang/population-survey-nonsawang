# พิกัดบ้าน → HOSxP

หน้าเว็บใช้ตำแหน่ง GPS หลังผู้ใช้กดยืนยัน บันทึก population และสร้างคิวใน transaction เดียวกัน พิกัดคลาดเคลื่อนต้องไม่เกิน 100 เมตร รองรับ staff/admin/vhv ตามขอบเขตหมู่เดิม ไม่มีการเขียน HOSxP จากเบราว์เซอร์

## ติดตั้งก่อนใช้งาน
1. รัน migrations/20261028_house_gps.sql ใน Supabase หลังระบบ app_current_user และ app_private.in_scope เดิม
2. รัน scripts/house-gps-receipts.sql ใน HOSxP โดยผู้ดูแล (สร้างตารางหลักฐานเท่านั้น)
3. ตั้ง .env.sync ตามตัวเชื่อมเดิม และรัน node scripts/house-gps-lan.cjs snapshot เพื่ออ่านบ้านและพิกัดเดิม ภาพอ้างอิงมีอายุ 24 ชั่วโมง ชุดอัปโหลดไม่ครบจะไม่ถูกใช้
4. Deploy เว็บใหม่ ระบบจะรับคิว pending เมื่อผู้ใช้ยืนยัน ปิดการส่งไว้โดยค่าเริ่มต้น
5. หลังตรวจการตั้งค่าฐานปลายทาง ให้ตั้ง HOSXP_HOUSE_GPS_WRITE_ENABLED=true แล้วรัน node scripts/house-gps-lan.cjs send <queue-uuid> ทีละรายการ
6. หากเขียนแล้วแจ้งผลกลับไม่สำเร็จ ใช้ node scripts/house-gps-lan.cjs recover <queue-uuid> ตรวจหลักฐานแล้วแจ้งผลเท่านั้น ไม่เขียนใหม่

ตัวส่งล็อก house/village ตรวจ house_id, village_id, บ้านเลขที่, หมู่ และค่าพิกัดเดิม เขียนเฉพาะ house.latitude/longitude ไม่แตะพิกัดหมู่บ้านหรือ UTM ต้องเป็น InnoDB ทั้งบ้าน หมู่บ้าน และตารางหลักฐาน

processing ที่ไม่มี receipt ต้องตรวจสอบเอง ไม่คืน pending อัตโนมัติ conflict หมายถึงบ้านหรือพิกัดเดิมเปลี่ยน ต้องอ่าน snapshot และตรวจใหม่ ไม่มี scheduled task ติดตั้งให้เอง

ต้องใช้ HOSxP ฐานเดียวกันระหว่าง snapshot กับ send ห้ามเปลี่ยนปลายทาง .env.sync ระหว่างคิวค้าง ตรวจชื่อฐานและหน่วยบริการก่อนเปิดตัวส่ง

ผลทดสอบ: tests/house-gps-queue.cjs (PGlite) และ tests/house-gps-mysql.cjs (MariaDB แยก 127.0.0.1:33317)
การสร้างไฟล์เหล่านี้ยังไม่เท่ากับติดตั้ง migration/deploy หรือเขียนพิกัดจริง
