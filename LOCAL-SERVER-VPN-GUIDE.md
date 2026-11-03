# คู่มือติดตั้ง Local Dashboard + Local AI + PostgreSQL แยกบนเครื่องหน่วยบริการ และเชื่อมต่อผ่าน VPN

เอกสารนี้อธิบายสถาปัตยกรรมและขั้นตอนการติดตั้งระบบให้ทำงานอยู่บนเครื่องเซิร์ฟเวอร์ของ **รพ.สต.บ้านโนนสว่าง** โดยตรง (On-Premise / Local Appliance) โดยยังคงใช้โค้ดชุดเดิมและตัวเชื่อม HOSxP เดิมได้ครบถ้วน

---

## 1. สถาปัตยกรรมที่แนะนำ (ทำไมถึงดีที่สุดสำหรับ รพ.สต.)

```mermaid
flowchart LR
  subgraph VPN["เครือข่าย VPN (Tailscale / WireGuard)"]
    RemoteUser["มือถือ/คอมฯ เจ้าหน้าที่ & อสม.\n(เข้าผ่าน IP VPN / HTTPS)"]
  end

  subgraph FacilityServer["เครื่องแม่ข่ายหน่วยบริการ (รพ.สต.บ้านโนนสว่าง)"]
    NextWeb["Next.js Web & Local Dashboard\n(:3000)"]
    Ollama["Local AI (Ollama)\n127.0.0.1:11434"]
    Gateway["PostgREST Gateway (/rest/v1)\n127.0.0.1:54321"]
    LocalPG[("PostgreSQL 16 (แยกสำหรับเว็บ)\n127.0.0.1:54322")]
    Connector["ตัวเชื่อม HOSxP เดิม\n(scripts/*.cjs)"]
  end

  subgraph HospitalLAN["วง LAN ภายใน รพ.สต."]
    HOSxP[("ฐานข้อมูล HOSxP\n(MySQL / MariaDB :3306)")]
  end

  RemoteUser -->|เฉพาะพอร์ตเว็บ 3000/443| NextWeb
  NextWeb -->|สถิติสรุป (ไม่ส่ง CID/ชื่อ)| Ollama
  NextWeb -->|RLS + Session Token| Gateway
  Gateway --> LocalPG
  Connector -->|SELECT Read-Only / คิวอนุมัติ| HOSxP
  Connector -->|http://127.0.0.1:54321| Gateway
```

### เหตุผลที่เลือกชุดเทคโนโลยีนี้
1. **PostgreSQL 16 + PostgREST (`local-stack/docker-compose.yml`)**:
   - โปรเจกต์นี้มี Stored Functions (`rpc`) และนโยบายสิทธิ์ `RLS` กว่า 30 ไฟล์ การรัน PostgreSQL คู่กับ PostgREST ที่พอร์ต `127.0.0.1:54321` ทำให้ทั้งเว็บ Next.js และสคริปต์ตัวเชื่อม HOSxP เดิม (`refresh-hosxp-review.cjs`, `hosxp-registry-sync.cjs`, `hosxp-fit-auto.cjs`) ทำงานได้ทันทีโดยไม่ต้องรื้อเขียน SQL หรือแก้โครงสร้าง API
   - แยกฐานข้อมูลของเว็บออกจากฐาน HOSxP อย่างเด็ดขาด ไม่กระทบภาระงานของ HOSxP
2. **Ollama เป็น Local AI Runtime (`127.0.0.1:11434`)**:
   - ติดตั้งบน Windows ได้โดยตรง รันเป็น Background Service อัตโนมัติเมื่อเปิดเครื่อง
   - **โมเดลภาษาไทยที่แนะนำตามสเปกเครื่อง**:
     - **RAM 16 GB ขึ้นไป**: แนะนำ `qwen2.5:7b` หรือ `scb10x/llama3.1-typhoon2-8b-instruct` (สรุปภาษาไทยและวิเคราะห์ตารางตัวเลขแม่นยำมาก)
     - **RAM 8 GB (CPU ล้วน)**: แนะนำ `qwen2.5:3b` (ใช้ RAM เพียง ~2.5 GB ตอบไวใน 2–5 วินาที)
   - หากยังไม่ได้เปิด Ollama หน้า Dashboard และหน้าติดตามงานสำรวจยังมี **Built-in Local Analyzer** ที่สรุปจุดเร่งด่วนและจัดลำดับคิวงานให้ทันทีโดยไม่ต้องพึ่งอินเทอร์เน็ต
3. **Tailscale (หรือ WireGuard) สำหรับใช้งานจากภายนอกผ่าน VPN**:
   - ไม่ต้องตั้งค่า Port Forwarding ที่เราเตอร์ของ รพ.สต. (ทะลุ CGNAT ได้อัตโนมัติ)
   - เปิดให้เข้าถึงเฉพาะพอร์ตเว็บ Next.js (`3000` หรือ HTTPS `443` ผ่าน `tailscale serve`) ในขณะที่ฐานข้อมูล PostgreSQL (`127.0.0.1:54321`), HOSxP และ Ollama (`127.0.0.1:11434`) ถูกผูกไว้กับ `127.0.0.1` เท่านั้น จึงไม่มีใครจากภายนอกยิงตรงเข้าฐานข้อมูลได้

---

## 2. ขั้นตอนการติดตั้ง PostgreSQL แยกสำหรับเว็บบนเครื่องหน่วยบริการ

### ขั้นที่ 1: สร้างกุญแจ JWT สำหรับระบบโลคัล
รันคำสั่งต่อไปนี้ที่รากของโปรเจกต์:

```powershell
node scripts/generate-local-keys.cjs
```

นำค่าที่ได้ไปใส่ใน:
1. `local-stack/.env` (`POSTGRES_PASSWORD` และ `PGRST_JWT_SECRET`)
2. `.env.local` (สำหรับเว็บ Next.js)
3. `.env.sync` (สำหรับตัวเชื่อม HOSxP เดิม โดยชี้ `SUPABASE_URL=http://127.0.0.1:54321`)

### ขั้นที่ 2: เปิดใช้งาน PostgreSQL + PostgREST
```powershell
cd local-stack
docker compose up -d
```

จากนั้นนำเข้าโครงสร้างตารางและ Migrations (หรือ Restore จากไฟล์ Dump ของฐานเดิม) เข้าสู่ `postgres://postgres:<รหัสผ่าน>@127.0.0.1:54322/nonsawang`

---

## 3. ขั้นตอนการติดตั้ง Local AI (Ollama)

1. ดาวน์โหลดและติดตั้ง **Ollama for Windows** จาก `https://ollama.com/download`
2. เปิด PowerShell แล้วดึงโมเดลภาษาไทยลงเครื่อง (ทำครั้งเดียว):
   ```powershell
   # สำหรับเครื่อง RAM 16 GB ขึ้นไป
   ollama pull qwen2.5:7b

   # หรือสำหรับเครื่องประหยัดทรัพยากร (RAM 8 GB)
   ollama pull qwen2.5:3b
   ```
3. ตรวจสอบในไฟล์ `.env.local` ว่าตั้งค่าตรงกับโมเดลที่ดึงมา:
   ```dotenv
   LOCAL_AI_URL=http://127.0.0.1:11434
   LOCAL_AI_MODEL=qwen2.5:7b
   ```
4. เปิดหน้า `/dashboard` หรือ `/tracking` จะเห็นกล่อง **Local AI** ขึ้นสถานะสีเขียว `Ollama พร้อมใช้งาน` สามารถกดปุ่มวิเคราะห์ลัดหรือพิมพ์ถาม-ตอบได้เลย

---

## 4. การเชื่อมต่ออ่าน HOSxP ด้วยตัวเชื่อมเดิม

ตัวเชื่อมเดิมในโฟลเดอร์ `scripts/` ได้รับการปรับให้รองรับ `SUPABASE_URL=http://127.0.0.1:54321` (Loopback บนเครื่องหน่วยบริการ) แล้ว:

```dotenv
# ตัวอย่างไฟล์ .env.sync บนเครื่องหน่วยบริการ
HOSXP_DB_HOST=192.168.1.xxx
HOSXP_DB_PORT=3306
HOSXP_DB_NAME=hosxp_pcu
HOSXP_DB_USER=read_only_user
HOSXP_DB_PASSWORD=your_hosxp_password
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_จาก_generate-local-keys.cjs>
```

ทดสอบดึงข้อมูลอ้างอิงจาก HOSxP เข้า PostgreSQL บนเครื่องหน่วยบริการ:
```powershell
node scripts/refresh-hosxp-review.cjs
node scripts/hosxp-registry-sync.cjs
```

---

## 5. การเปิดใช้งานจากภายนอกผ่าน VPN (Tailscale)

1. ติดตั้ง **Tailscale** บนเครื่องแม่ข่ายหน่วยบริการและอุปกรณ์ของเจ้าหน้าที่ที่ได้รับอนุญาต
2. รันเว็บเซิร์ฟเวอร์ Next.js:
   ```powershell
   npm run build
   npm run start
   ```
3. **(แนะนำ)** เปิด HTTPS ภายในวง VPN ด้วยคำสั่งเดียวของ Tailscale:
   ```powershell
   tailscale serve --bg 3000
   ```
   - เมื่อใช้ `tailscale serve` ผู้ใช้ในวง VPN จะเข้าผ่าน `https://<ชื่อเครื่อง>.<tailnet>.ts.net` ได้ทันทีพร้อมใบรับรอง HTTPS (และสามารถตั้ง `ALLOW_HTTP_SESSION=false` ได้)
   - หากเข้าผ่าน IP VPN ตรงๆ แบบ HTTP เช่น `http://100.x.y.z:3000` ให้ตั้ง `ALLOW_HTTP_SESSION=true` ใน `.env.local` เพื่อให้เบราว์เซอร์รับคุกกี้เซสชันบน HTTP ภายในวง VPN ได้
