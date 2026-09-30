# ทดสอบฐานจริงแบบอ่านข้อมูลบริการเท่านั้น

ผู้ใช้อนุมัติให้เริ่มทดสอบอ่านฐานจริง โหมดนี้เพิ่มเติมจากแนวทางฐานทดสอบแยก
ใน SETUP-TEST-DATABASE.md; ไม่อนุญาตทดสอบการเขียนข้อมูลบริการจริง

ตั้ง `APP_READ_ONLY=true` ทั้งตอน build และ runtime หากเป็น Vercel Preview
ให้ตั้ง `PREVIEW_SUPABASE_PROJECT_REF=gxidztlvqsppixlwrxeo` และ URL/key ของฐาน
จริงให้ตรงกัน การเชื่อมฐานจริงใน Preview โดยไม่เปิดโหมดนี้ยังถูกปฏิเสธ
ทดสอบในเครื่องที่ `http://localhost:3197/login` โดย bind เฉพาะ localhost
และโหลด credentials เข้า environment ของ process โดยไม่คัดลอก `.env.sync`
หรือกุญแจลงไฟล์ในสำเนาทดสอบ

## สิ่งที่อนุญาต

- Login ด้วยบัญชี/รหัสผ่าน, อ่าน session, logout ตามระบบเดิม
- อ่านตารางที่ API เดิมอนุญาต ภายใต้ session และ RLS เดิม
- เรียกเฉพาะ RPC อ่านข้อมูลที่ตรวจและใส่ allowlist ไว้ เช่น screening_search

**ข้อจำกัดของคำว่าอ่านอย่างเดียว:** การ login ยังสร้าง session, ตรวจ rate limit,
บันทึก last_login และอาจอัปเกรดแฮชรหัสผ่านเดิมตามระบบ authentication ปกติ
ไม่ได้ใช้ฐาน PostgreSQL แบบ read-only transaction ทั้งระบบ โหมดนี้บล็อก
การเขียนข้อมูลบริการ/คิวธุรกิจที่ web API

## สิ่งที่บล็อกที่เซิร์ฟเวอร์ ก่อนเรียกฐานข้อมูล

- POST/PATCH ตารางทั้งหมด, RPC เขียนทุกตัว และ RPC ใหม่ที่ไม่อยู่ใน allowlist
- อนุมัติคัดกรอง/เตรียม FIT/อนุมัติหรือ refresh Authen/แก้บุคคลหรือบัญชี
- อัปโหลดรายงาน Authen
- LINE login และการผูก LINE ผ่าน password login
- เปิด review session สำหรับการอนุมัติ HOSxP (จึงทดสอบส่วนที่ต้องยืนยันสิทธิ์
  ผู้ตรวจสอบซ้ำไม่ได้ในโหมดนี้)

ใช้ cookie `population_preview_session` แยกจาก `population_session` ของเว็บจริง
แสดงแถบแจ้งสถานะทุกหน้า ปุ่มเดิมบางปุ่มยังเห็นได้ แต่กดแล้ว API ปฏิเสธ 403
พร้อม `READ_ONLY_MODE` ไม่ถือว่าเป็นการบันทึกสำเร็จ
ร่างแนวเขตที่หน้าแผนที่เก็บใน localStorage อาจเปลี่ยนได้เฉพาะเครื่องทดสอบ

## ผลตรวจ

- build ผ่านทั้งข้อมูลจำลองและ configuration ฐานจริงแบบ read-only
- unit/API tests: คำสั่งเขียนและอัปโหลดถูกปฏิเสธโดยไม่มี upstream call
- actual Next runtime + synthetic DB: login/session/logout, async cookies/params,
  cookie แยก, CSRF, no-store และ mutation guards ผ่าน
- เซิร์ฟเวอร์ที่ชี้ฐานจริง: anonymous read ได้ 401, คำสั่งเขียนตัวอย่างได้ 403
- ตรวจ UI หลังผู้ใช้ login เจ้าหน้าที่แล้ว: ภาพรวมงานสำรวจ, ค้นหา FIT ด้วยชื่อและเลขบัตร, เปิดผล/วันที่และประวัติเดิม, แผนที่พร้อมหมุด และหน้าสถานะ FIT/Authen โหลดได้
- 30 กันยายน 2569 ผู้ใช้ login เจ้าหน้าที่ใหม่แล้ว: แดชบอร์ดโหลดตัวเลข KPI และตารางสรุปสำเร็จ แสดงประชากร 12,276 คน ตรวจภาพกราฟแยกหมู่บ้านและกราฟวงกลมแล้วแสดงผลได้ ไม่พบสถานะโหลดล้มเหลวในหน้าที่ตรวจ (เป็นการตรวจการแสดงผล ไม่ใช่ตรวจสอบความถูกต้องของข้อมูลทุกแถว)
- ยังไม่ได้ทดสอบ mobile, LINE หรือบัญชี อสม. จริง (สิทธิ์ อสม. ผ่าน fixture tests ก่อนหน้า)

ไม่ได้แก้ Supabase schema, ปิด Scheduler, สร้าง visit หรือ deploy production
ห้ามนำ artifact ที่สร้างแบบ read-only ไปแทน production โดยไม่สร้าง build ใหม่
และตรวจค่าตั้งค่าให้ตรงโหมดที่ตั้งใจ
