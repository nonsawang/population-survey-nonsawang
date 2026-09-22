'use client';
export default function FitAuthen({vn,checks,verifiedAt}){
 const known=typeof checks?.auth==='boolean';
 return <section className="border rounded bg-light p-3 my-3" aria-label="จัดการ Authen">
  <h6>Authen สำหรับ VN {vn}</h6>
  <p className="mb-1">{!known?'ยังไม่มีข้อมูลตรวจ Authen':checks.auth?'พบเลข Authen บันทึกใน HOSxP ของ VN นี้':'ยังไม่พบเลข Authen ใน HOSxP ของ VN นี้'}</p>
  <p className="small text-muted">ตรวจข้อมูลล่าสุด: {verifiedAt?new Date(verifiedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่ทราบ'} • เป็นข้อมูลจากรอบตรวจของตัวเชื่อม LAN</p>
  <div className="d-flex flex-wrap gap-2 mb-2">
   <a className="btn btn-outline-primary" href="https://authenservice.nhso.go.th/authencode/claimcode/search/history" target="_blank" rel="noopener noreferrer">ตรวจประวัติ Authen ที่ สปสช.</a>
   <a className="btn btn-primary" href="https://authenservice.nhso.go.th/authencode/claimcode/create/own" target="_blank" rel="noopener noreferrer">เปิด New Authen</a>
  </div>
  <ol className="small mb-2 ps-3">
   <li>ตรวจประวัติก่อนขอเลขใหม่ เพื่อไม่ขอซ้ำ</li>
   <li>ยืนยันตัวตนตามช่องทางของ สปสช. และตรวจผู้รับบริการ วันที่บริการ และประเภทบริการ</li>
   <li>บันทึกเลขที่ได้รับใน HOSxP ให้ตรงกับ VN นี้ แล้วรอตัวเชื่อมตรวจกลับ</li>
  </ol>
  <p className="small mb-0">การเปิดหน้านี้ยังไม่ขอเลขอัตโนมัติและไม่ส่งข้อมูลผู้ป่วยไปกับลิงก์ การพบเลขใน HOSxP ไม่ได้ยืนยันว่าเลขผ่านการตรวจสอบจาก สปสช. หรือพร้อมส่งเบิก</p>
 </section>;
}
