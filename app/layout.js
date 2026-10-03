import { AuthProvider } from '@/lib/auth';
import Script from 'next/script'; // 🟢 ดึง Script ของ Next.js มาใช้
import './globals.css';
import previewDatabase from '@/lib/preview-database.cjs';

export const metadata = {
  title: 'ระบบสุขภาพโนนสว่าง — รพ.สต.บ้านโนนสว่าง',
  description: 'ระบบสำรวจประชากรรายครัวเรือนและคัดกรองสุขภาพ เชื่อมโยง HOSxP โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านโนนสว่าง',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=Prompt:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {previewDatabase.isReadOnly() && <div role="status" style={{background:'#fff3cd',color:'#664d03',padding:'12px',textAlign:'center'}}>ทดสอบอ่านข้อมูลจริงเท่านั้น — บันทึก แก้ไข อนุมัติ และอัปโหลดถูกปิด — เข้าสู่ระบบด้วยบัญชี/รหัสผ่าน</div>}
        <AuthProvider>
          {children}
        </AuthProvider>

        {/* 🟢 ใช้ Script ของ Next.js แทนการพิมพ์แท็ก script ตรงๆ เพื่อป้องกัน Error หน้าขาว */}
        <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
