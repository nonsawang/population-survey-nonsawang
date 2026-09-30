# เตรียมฐานทดสอบสำหรับ Next.js 16

สถานะ: เตรียมขั้นตอนแล้ว ยังไม่ได้สร้างโครงการ Supabase หรือ deploy Preview

## 1. สร้างโครงการใหม่

เปิด Supabase Dashboard → New project ตั้งชื่อ เช่น
`population-survey-nonsawang-test` เลือกองค์กรและ region ที่เหมาะสม
ตรวจค่าใช้จ่าย/โควตาที่หน้าสร้างโครงการก่อนยืนยัน ตั้งรหัสฐานข้อมูลใหม่
และเก็บในตัวจัดการรหัสผ่าน ไม่ส่งรหัสผ่านหรือ API key ในแชท

เก็บ Project URL และ Project ref ของโครงการใหม่ไว้ โครงการนี้ต้องไม่ใช่
`gxidztlvqsppixlwrxeo` ซึ่งเป็นฐานจริง

## 2. เตรียมโครงสร้างโดยไม่คัดลอกข้อมูลผู้ป่วย

**ข้อค้นพบจาก repo:** migrations ที่มีอยู่เริ่มจากการปรับตารางเดิม ไม่ได้มี
สคริปต์สร้างฐานเริ่มต้นครบทุกตาราง ดังนั้นห้ามนำไฟล์ทั้งหมดไปรันเรียงชื่อบน
ฐานว่างแล้วถือว่าครบ เช่น `auth_activate` ต้องตามหลัง `auth_prepare`
แม้ลำดับตัวอักษรจะกลับกัน

แนวทางสำหรับฐานทดสอบคือ export เฉพาะ schema ปัจจุบันจากฐานจริง แล้ว restore
เข้าโครงการทดสอบใหม่ โดยดำเนินการ export แบบอ่านอย่างเดียว:

1. ใช้ Supabase CLI / PostgreSQL schema-only dump ของ application schemas
   `public` และ `app_private` รวม tables, functions, triggers, sequences,
   indexes, grants และ RLS policies โดย **ไม่ใช้ `--data-only`**
2. ตรวจไฟล์ก่อน restore: dependencies ของ extensions (เช่น pgcrypto/pg_trgm),
   function bodies และค่า default ต้องไม่ฝัง secret หรือปลายทาง production
   ไม่คัดลอก cron jobs, webhooks, vault secrets, auth users หรือ storage files
3. เปิด extension ที่จำเป็นในโครงการทดสอบตาม schema ที่ export จริง
   แล้ว restore โครงสร้างเข้าโครงการทดสอบเท่านั้น
4. เทียบ schema ที่ restore กับโค้ดรุ่น `f0aa20d` หากฐานจริงยังไม่มี migration
   ล่าสุด ให้ติดตั้งเฉพาะส่วนที่ขาดในฐานทดสอบ ไม่รัน migration เก่าทับทั้งหมด
5. เก็บ schema snapshot เป็น baseline สำหรับสร้างฐานทดสอบครั้งต่อไป
   ตรวจ secret ก่อน commit และอย่าเก็บ connection string ในไฟล์นี้

ตัวอย่าง CLI หลังติดตั้งเครื่องมือและตั้ง connection string แบบส่วนตัวแล้ว:

```powershell
# ตัวแปรนี้ต้องชี้ฐานต้นทาง ใช้เฉพาะ dump แบบอ่านอย่างเดียว
supabase db dump --db-url "$env:SOURCE_DATABASE_URL" --schema public,app_private -f test-schema.sql
# ตรวจ test-schema.sql ก่อน restore ไม่ใส่ข้อมูลผู้ป่วย/บัญชีจริง
# TARGET_TEST_DATABASE_URL ต้องเป็นฐานใหม่ ตรวจ Project ref ก่อนสั่ง
psql "$env:TARGET_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f test-schema.sql
```

คำสั่งเป็นขั้นตอนสำหรับผู้ดูแล ยังไม่ได้รันในงานนี้ ตรวจข้อกำหนดของ CLI,
Docker/pg_dump, SSL และ connection mode ตามเครื่องที่ใช้ก่อนรัน
อย่าเก็บ URL ที่มีรหัสผ่านไว้ใน shell history หรือ log ที่แชร์

## 3. ตรวจสิทธิ์และเพิ่มข้อมูลจำลอง

ใช้ `scripts/verify-test-database.sql` ใน SQL Editor ของโครงการทดสอบ
ตรวจว่าตารางสำคัญเปิด RLS, RPC มีครบ และตารางธุรกรรม/คิวยังว่าง
ตรวจคอลัมน์จริงของ `app_users` ก่อนสร้างบัญชีทดสอบ โดยใช้รูปแบบแฮชที่ระบบ
รองรับ ไม่คัดลอกบัญชี/รหัสผ่าน/LINE user ID ของเจ้าหน้าที่จริง

สร้างบัญชีสมมติสำหรับ admin, staff, manager และ vhv อย่างน้อยสองหมู่
และข้อมูลบุคคลสมมติสำหรับ HBV/HCV, FIT, HPV และพัฒนาการเด็ก
ทดสอบ อสม. ข้ามหมู่ไม่ได้ และผู้บริหารแก้ข้อมูลไม่ได้
ผล/วันที่/เลข Authen ในข้อมูลทดสอบต้องสมมติทั้งหมด

ไม่ต้องติดตั้ง LAN connector สำหรับขั้นนี้ และไม่ตั้ง `.env.sync` หรือ
Task Scheduler ให้ชี้โครงการทดสอบ แม้จะมีรายการอนุมัติทดสอบก็ต้องไม่มี worker
ที่สามารถเขียน HOSxP จริงมาอ่านคิวนี้

## 4. ตั้งค่า Vercel เฉพาะ Preview

Project → Settings → Environment Variables → เลือก **Preview**
โดยกำหนดเฉพาะ branch อัปเกรดได้ ตรวจว่าไม่มีค่าฐานจริงตกทอดอยู่

| ตัวแปร | ค่าที่ใช้ |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<test-project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key จากโครงการทดสอบ |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key จากโครงการทดสอบ เก็บฝั่งเซิร์ฟเวอร์เท่านั้น |
| `PREVIEW_SUPABASE_PROJECT_REF` | test-project-ref 20 ตัวอักษร |
| `LINE_LOGIN_CHANNEL_ID` / ค่าฝั่ง LIFF ที่โปรเจกต์ใช้ | ใช้ LINE channel ทดสอบ พร้อม callback URL ที่ถูกต้อง หากจะทดสอบ LINE |

คง Environment Variables ของ **Production** เดิมไว้ ใช้ Node 24.x ตาม package.json
ตั้งค่าเสร็จแล้วสร้าง deployment ใหม่ เพราะ NEXT_PUBLIC ถูกผูกตอน build
ตัว guard จะปฏิเสธ Preview ที่ยังชี้โครงการ production หรือไม่ระบุ test ref

## 5. ตรวจรับ Preview ก่อนเปิดใช้จริง

- Login/logout และ session หมดอายุ, staff/VHV/manager/admin
- ค้นหาชื่อ/เลขบัตรด้วยข้อมูลสมมติและคงขอบเขตหมู่
- คัดกรองทั้ง 4 ประเภท บันทึกแล้วเปิดกลับเห็นผลและวันที่เดิม
- แผนที่/หมุด/แนวเขตและหน้ามือถือ พร้อมตรวจ browser console
- อัปโหลดรายงาน Authen สมมติ ตรวจ CID/วันที่/แถวซ้ำและคิวอนุมัติ
- ยืนยันว่า Preview ใช้ test project จริง และไม่มี LAN worker อ่านโครงการนี้
- ทดสอบ LINE บนช่องทางทดสอบก่อนถือว่าครบ ไม่ถือว่า HTTP smoke test แทนได้

เมื่อผ่านจึงสร้าง production build ด้วย production environment และวางแผน
เปิดใช้จริง ห้าม promote artifact ที่ฝังค่า test Supabase ไปใช้จริงโดยตรง
จด deployment URL/commit ปัจจุบันไว้สำหรับ rollback

เอกสารอ้างอิง:
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://vercel.com/docs/environment-variables
