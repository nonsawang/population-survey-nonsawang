'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';

const SCENES = [
  {
    id: 1,
    badge: 'บทที่ 1 / 8',
    title: 'เข้าใช้งานผ่าน LINE LIFF & ผูกบัญชีครั้งแรก',
    durationSec: 16,
    voiceText:
      'บทที่ 1 การเข้าสู่ระบบผ่านไลน์ลิฟ ให้กดลิงก์ระบบจากกลุ่มไลน์ อสม. จากนั้นกดปุ่มสีเขียว เข้าสู่ระบบด้วยไลน์ หากเข้าใช้งานครั้งแรก ระบบจะแสดงรูปโปรไฟล์ไลน์ของท่าน ให้เลือกปุ่ม อสม. แล้วกรอกเลขบัตรประชาชน 13 หลักของท่าน จากนั้นกดปุ่ม ยืนยันและผูกบัญชีไลน์ ครั้งต่อไปเมื่อกดเข้าจากไลน์ ระบบจะเข้าใช้งานได้ทันทีโดยไม่ต้องกรอกรหัสอีกค่ะ',
    steps: [
      'กดลิงก์ระบบสุขภาพโนนสว่างจากในแชท LINE หรือเมนูกลุ่ม อสม.',
      'กดปุ่มสีเขียว "เข้าสู่ระบบด้วย LINE"',
      'เฉพาะครั้งแรก: เลือกปุ่ม "อสม." → กรอกเลขบัตรประชาชน 13 หลัก → กด "ยืนยันและผูกบัญชี LINE"',
      'ครั้งต่อไปที่เปิดผ่าน LINE ระบบจะจำบัญชีและพาเข้าหน้าบ้านของฉันอัตโนมัติ',
    ],
    tip: 'เลขบัตร 13 หลักใช้เฉพาะตอนผูกบัญชีครั้งแรกเท่านั้น ห้ามใช้บัญชี LINE ร่วมกับผู้อื่น',
    mockup: 'login',
  },
  {
    id: 2,
    badge: 'บทที่ 2 / 8',
    title: 'หน้า "บ้านที่ฉันรับผิดชอบ" เลือกบ้านลงสำรวจ',
    durationSec: 14,
    voiceText:
      'บทที่ 2 หน้าบ้านที่ฉันรับผิดชอบ เมื่อเข้าสู่ระบบแล้ว อสม. จะพบรายชื่อบ้านที่ตนเองรับผิดชอบทั้งหมด ระบบจะแยกป้ายชัดเจนว่าบ้านไหนสำรวจครบแล้ว และบ้านไหนยังต้องติดตาม ให้กดเลือกหัวข้อ งานที่ยังไม่ครบ แล้วแตะที่บ้านเลขที่ เพื่อเปิดหน้าสำรวจบ้านหลังนั้นได้ทันทีค่ะ',
    steps: [
      'หลังล็อกอิน ระบบจะเปิดหน้า "บ้านที่ฉันรับผิดชอบ" อัตโนมัติ',
      'ดูยอดสรุป: บ้านที่รับผิดชอบทั้งหมด / สำรวจครบแล้ว / ยังไม่ครบ',
      'แตะที่การ์ดบ้านเลขที่ที่ต้องการ เพื่อเปิดรายชื่อสมาชิกในครัวเรือน',
    ],
    tip: 'สามารถกดเมนู "บ้านของฉัน" บนแถบเมนูด้านบนเพื่อกลับมาหน้านี้ได้ตลอดเวลา',
    mockup: 'my-houses',
  },
  {
    id: 3,
    badge: 'บทที่ 3 / 8',
    title: 'ปักหมุดพิกัดหลังคาบ้าน (GPS) หน้าบ้านจริง',
    durationSec: 13,
    voiceText:
      'บทที่ 3 การบันทึกพิกัดจีพีเอสหลังคาบ้าน เมื่อเดินไปถึงหน้าบ้านที่กำลังสำรวจ ให้กดปุ่มสีฟ้า บันทึกพิกัดบ้าน เข้าคิว ฮอสเอ็กซ์พี หากมือถือถามสิทธิ์ตำแหน่ง ให้กด อนุญาต ระบบจะจับพิกัดดาวเทียมและบันทึกตำแหน่งหลังคาบ้านทันทีค่ะ',
    steps: [
      'ยืนอยู่บริเวณบ้านที่กำลังสำรวจ แล้วเปิดข้อมูลบ้านหลังนั้น',
      'กดปุ่มสีฟ้า "📍 บันทึกพิกัดบ้าน / เข้าคิว HOSxP" ในกล่องหัวข้อบ้าน',
      'กด "อนุญาต (Allow)" ให้เบราว์เซอร์/LINE เข้าถึงตำแหน่ง GPS',
    ],
    tip: 'ควรยืนกลางแจ้งหรือหน้าชายคาบ้านเพื่อให้สัญญาณ GPS แม่นยำไม่คลาดเคลื่อน',
    mockup: 'gps',
  },
  {
    id: 4,
    badge: 'บทที่ 4 / 8',
    title: 'บันทึกโรคประจำตัว (เลือกหลายโรคได้) & สถานะ Type 1–4',
    durationSec: 18,
    voiceText:
      'บทที่ 4 การบันทึกโรคประจำตัวและสถานะการอยู่อาศัย ในการ์ดของแต่ละคน ให้เลือกสถานะในบ้าน และกดช่องโรคประจำตัว ซึ่งสามารถติ๊กเลือกควบคู่กันหลายโรคได้ เช่น เบาหวาน ร่วมกับ ความดันโลหิตสูง แล้วกดบันทึก จากนั้นเลือกประเภทอยู่อาศัย ไทป์ 1 ถึง 4 และสถานะจำหน่าย แล้วกดปุ่มสีน้ำเงิน บันทึกประเภทอยู่อาศัยและสถานะจำหน่าย ค่ะ',
    steps: [
      'เลือก "สถานะในบ้าน" (เช่น เจ้าบ้าน, ผู้อาศัย, บุตร/หลาน)',
      'กดปุ่ม "โรคประจำตัว" → ติ๊กเลือกได้หลายโรคพร้อมกัน (โรคไขว้) หรือพิมพ์ระบุโรคอื่นๆ → กดบันทึกโรค',
      'เลือก "ประเภทอยู่อาศัย" (Type 1 มีชื่ออยู่จริง / Type 2 มีชื่อไม่อยู่ / Type 3 มาอาศัยไม่มีชื่อในทะเบียน)',
      'เลือก "สถานะจำหน่าย" (ปกติเลือก 9 = ไม่จำหน่าย) แล้วกดปุ่มสีน้ำเงินเพื่อบันทึก',
    ],
    tip: 'หากผู้ป่วยไม่มีโรคประจำตัว ให้ติ๊ก "ปกติ (ไม่มีโรค)" ระบบจะล้างรายการโรคอื่นให้อัตโนมัติ',
    mockup: 'chronic-type',
  },
  {
    id: 5,
    badge: 'บทที่ 5 / 8',
    title: 'คัดกรองบุหรี่ • สุรา • พยาธิใบไม้ตับ (OV)',
    durationSec: 15,
    voiceText:
      'บทที่ 5 การคัดกรองพฤติกรรมเสี่ยงและพยาธิใบไม้ตับ เลื่อนลงมาด้านล่างของการ์ดรายบุคคล กดเลือกสถานะการสูบบุหรี่ และการดื่มสุรา หากสูบหรือดื่ม ระบบจะเปิดคำถามประเมินให้ตอบต่อทันที และสำหรับผู้ที่มีอายุ 15 ปีขึ้นไป ให้ตอบแบบคัดกรองพยาธิใบไม้ตับ โอวี ทั้ง 5 ข้อ แล้วกดบันทึกค่ะ',
    steps: [
      'หัวข้อ "คัดกรองพฤติกรรมเสี่ยง": เลือกสถานะ สูบบุหรี่ และ ดื่มสุรา แล้วกดบันทึก',
      'หากเลือก "สูบ" หรือ "ดื่ม" ให้กดทำแบบประเมิน Fagerstrom / ASSIST จนครบ',
      'สำหรับผู้ที่อายุ 15 ปีขึ้นไป: ตอบคำถามคัดกรองพยาธิใบไม้ตับ (OV) 5 ข้อ แล้วกดบันทึกผล',
    ],
    tip: 'เมื่อบันทึกครบทุกส่วน บ้านหลังนี้จะเปลี่ยนสถานะเป็น "สำรวจครบ" ทันที',
    mockup: 'screening-card',
  },
  {
    id: 6,
    badge: 'บทที่ 6 / 8',
    title: 'การย้ายบ้านในหมู่ & คิวยืนยันย้ายข้ามหมู่',
    durationSec: 17,
    voiceText:
      'บทที่ 6 การย้ายบ้านในทะเบียนสำรวจ หากลูกบ้านย้ายไปอยู่อีกหลัง ให้กดปุ่ม ย้ายบ้านในทะเบียนสำรวจ เลือกหมู่และพิมพ์บ้านเลขที่ใหม่ที่มีอยู่ในระบบ ถ้าย้ายภายในหมู่เดียวกัน ระบบจะย้ายเข้าบ้านใหม่ทันที แต่ถ้า อสม. กดย้ายข้ามหมู่ ระบบจะติดป้าย รอยืนยันย้ายเข้า เพื่อให้ อสม. หมู่ปลายทาง หรือเจ้าหน้าที่กดรับเข้าบ้านค่ะ',
    steps: [
      'กดปุ่ม "🚚 ย้ายบ้านในทะเบียนสำรวจ (ในหมู่ / ข้ามหมู่)" บนการ์ดของบุคคลนั้น',
      'เลือกหมู่ที่ย้ายไป และระบุบ้านเลขที่ปลายทาง (ต้องเป็นบ้านที่มีอยู่ในระบบแล้ว)',
      'ย้ายในหมู่ตัวเอง = ย้ายทันที | ย้ายข้ามหมู่ = ขึ้นป้าย "⏳ รอยืนยันย้ายเข้า"',
      'อสม. หมู่ปลายทางจะเห็นกล่องแจ้งเตือนสีเหลืองด้านบนสุด กดปุ่ม "✓ ยืนยันรับเข้าบ้าน" ได้เลย',
    ],
    tip: 'การย้ายนี้เป็นการย้ายในทะเบียนสำรวจของระบบ เพื่อให้อสม.หมู่ปลายทางดูแลต่อ',
    mockup: 'transfer',
  },
  {
    id: 7,
    badge: 'บทที่ 7 / 8',
    title: 'บันทึกผลตรวจคัดกรอง 4 KPI (วัณโรค • มะเร็งลำไส้ FIT • OV • เด็ก)',
    durationSec: 14,
    voiceText:
      'บทที่ 7 หน้าคัดกรองรายบุคคล 4 เคพีไอ กดปุ่มเมนูด้านบนแล้วเลือก คัดกรองรายบุคคล สามารถค้นหาชื่อลูกบ้านเพื่อบันทึกผลตรวจวัณโรค มะเร็งลำไส้ใหญ่ฟิตเทสต์ พยาธิใบไม้ตับ และพัฒนาการเด็ก ตามกลุ่มเป้าหมายของแต่ละคนได้เลยค่ะ',
    steps: [
      'กดปุ่ม "เมนู" มุมขวาบน → เลือก "คัดกรองรายบุคคล"',
      'พิมพ์ค้นหาชื่อ หรือเลือกกรองตามกลุ่มเป้าหมาย KPI ที่ยังไม่ได้ตรวจ',
      'กดเลือกผลการคัดกรอง (ปกติ / ผิดปกติ) แล้วกดบันทึกผล',
    ],
    tip: 'รายการที่บันทึกผลแล้วจะส่งต่อให้เจ้าหน้าที่ รพ.สต. ตรวจสอบและเชื่อมข้อมูลเข้า HOSxP',
    mockup: 'kpi',
  },
  {
    id: 8,
    badge: 'บทที่ 8 / 8',
    title: 'ดูแผนที่หลังคาบ้าน 3 สี (เขียว • ส้ม • แดง)',
    durationSec: 14,
    voiceText:
      'บทที่ 8 การดูแผนที่สุขภาพจีไอเอส กดเมนู แผนที่ เพื่อดูขอบเขตหมู่บ้านและหมุดหลังคาบ้าน หมุดสีเขียวคือบ้านที่สำรวจและคัดกรองครบแล้ว หมุดสีส้มคือสำรวจแล้วแต่ยังเหลือคัดกรอง และหมุดสีแดงคือบ้านที่ยังไม่ได้สำรวจ สามารถแตะที่หมุดบ้านบนแผนที่เพื่อเปิดหน้าสำรวจบ้านหลังนั้นได้ทันทีค่ะ',
    steps: [
      'เปิดเมนู "แผนที่" เพื่อดูภาพรวมหลังคาบ้านในหมู่บ้านของตน',
      '🟢 หมุดสีเขียว = สำรวจและคัดกรองครบถ้วนแล้ว',
      '🟠 หมุดสีส้ม = สำรวจประชากรแล้ว แต่ยังเหลือคัดกรอง KPI',
      '🔴 หมุดสีแดง = ยังไม่ได้สำรวจ (แตะที่หมุดแล้วกด "เปิดหน้าสำรวจบ้านนี้" ได้ทันที)',
    ],
    tip: 'สามารถสลับมุมมองแผนที่ดาวเทียมเพื่อดูหลังคาบ้านจริงได้จากปุ่มมุมขวาบนของแผนที่',
    mockup: 'map',
  },
];

function PhoneMockupScreen({ type, tick }) {
  const pulse = tick % 2 === 0;

  if (type === 'login') {
    return (
      <div className="p-3">
        <div className="text-center mb-2">
          <div
            className="mx-auto rounded-circle d-flex align-items-center justify-content-center text-white mb-1"
            style={{ width: 42, height: 42, background: '#1e40af' }}
          >
            <i className="fa-solid fa-hospital" />
          </div>
          <div className="fw-bold small">ระบบสุขภาพโนนสว่าง</div>
          <div className="text-muted" style={{ fontSize: '.7rem' }}>
            เปิดผ่าน LINE LIFF
          </div>
        </div>

        <div
          className="p-2 rounded-3 text-white fw-bold text-center mb-2 position-relative"
          style={{
            background: '#00B900',
            fontSize: '.82rem',
            boxShadow: pulse ? '0 0 0 4px rgba(0,185,0,0.35)' : 'none',
            transition: 'all .3s',
          }}
        >
          <i className="fa-brands fa-line me-1" /> 1. กดเข้าสู่ระบบด้วย LINE
          <span
            className="badge bg-warning text-dark position-absolute"
            style={{ top: -8, right: 8, fontSize: '.62rem' }}
          >
            แตะตรงนี้
          </span>
        </div>

        <div className="border rounded-3 p-2 bg-light mb-2" style={{ fontSize: '.75rem' }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <div
              className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold"
              style={{ width: 28, height: 28, fontSize: '.7rem' }}
            >
              อสม
            </div>
            <div>
              <div className="fw-bold">อสม.สมศรี (LINE)</div>
              <div className="text-muted" style={{ fontSize: '.65rem' }}>
                ยืนยันบัญชีเพื่อผูก LINE ครั้งแรก
              </div>
            </div>
          </div>

          <div className="d-flex gap-1 mb-2">
            <div className="btn btn-sm btn-primary flex-fill py-1" style={{ fontSize: '.72rem' }}>
              ✓ อสม.
            </div>
            <div className="btn btn-sm btn-outline-secondary flex-fill py-1" style={{ fontSize: '.72rem' }}>
              เจ้าหน้าที่
            </div>
          </div>

          <div className="mb-2">
            <div className="text-muted mb-1" style={{ fontSize: '.68rem' }}>
              2. กรอกเลขบัตรประชาชน 13 หลัก
            </div>
            <div className="form-control form-control-sm bg-white fw-bold text-primary" style={{ letterSpacing: 2 }}>
              1459900XXXXXX
            </div>
          </div>

          <div
            className="btn btn-sm btn-primary w-100 fw-bold"
            style={{
              fontSize: '.76rem',
              boxShadow: !pulse ? '0 0 0 4px rgba(37,99,235,0.35)' : 'none',
              transition: 'all .3s',
            }}
          >
            3. ยืนยันและผูกบัญชี LINE
          </div>
        </div>
      </div>
    );
  }

  if (type === 'my-houses') {
    return (
      <div className="p-3" style={{ fontSize: '.78rem' }}>
        <div className="fw-bold text-primary mb-1">
          <i className="fa-solid fa-house me-1" /> บ้านที่ฉันรับผิดชอบ
        </div>
        <div className="text-muted mb-2" style={{ fontSize: '.68rem' }}>
          อสม.สมศรี • หมู่ 1 บ้านโนนสว่าง
        </div>

        <div className="row g-1 mb-2 text-center">
          <div className="col-4">
            <div className="p-2 rounded-3 border bg-white">
              <div className="fw-bold text-primary">15</div>
              <div style={{ fontSize: '.63rem' }}>บ้านทั้งหมด</div>
            </div>
          </div>
          <div className="col-4">
            <div className="p-2 rounded-3 border" style={{ background: '#ecfdf5' }}>
              <div className="fw-bold text-success">12</div>
              <div style={{ fontSize: '.63rem' }}>สำรวจครบ</div>
            </div>
          </div>
          <div className="col-4">
            <div
              className="p-2 rounded-3 border"
              style={{
                background: '#fffbeb',
                boxShadow: pulse ? '0 0 0 3px rgba(245,158,11,0.4)' : 'none',
              }}
            >
              <div className="fw-bold text-warning">3</div>
              <div style={{ fontSize: '.63rem' }}>ยังไม่ครบ</div>
            </div>
          </div>
        </div>

        <div className="border rounded-3 p-2 bg-white mb-2 shadow-sm">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <span className="fw-bold">บ้านเลขที่ 24/1 ม.1</span>
              <div className="text-muted" style={{ fontSize: '.66rem' }}>
                สมาชิก 4 คน • เหลือคัดกรอง 1 คน
              </div>
            </div>
            <span
              className="btn btn-sm btn-primary rounded-pill px-2 py-1"
              style={{
                fontSize: '.68rem',
                boxShadow: !pulse ? '0 0 0 4px rgba(37,99,235,0.35)' : 'none',
              }}
            >
              เปิดสำรวจ →
            </span>
          </div>
        </div>

        <div className="border rounded-3 p-2 bg-white">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <span className="fw-bold">บ้านเลขที่ 45 ม.1</span>
              <div className="text-success" style={{ fontSize: '.66rem' }}>
                ✓ สำรวจและคัดกรองครบแล้ว
              </div>
            </div>
            <span className="badge bg-success-subtle text-success">ครบแล้ว</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'gps') {
    return (
      <div className="p-3" style={{ fontSize: '.78rem' }}>
        <div className="border rounded-3 p-3 bg-white shadow-sm mb-2">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <div className="text-muted" style={{ fontSize: '.68rem' }}>
                <i className="fa-solid fa-house text-primary me-1" /> ม.1 บ้านเลขที่ <strong>24/1</strong>
              </div>
              <div className="fw-bold text-success" style={{ fontSize: '.74rem' }}>
                <i className="fa-solid fa-user-nurse me-1" /> อสม: นางสมศรี
              </div>
            </div>
            <span className="badge bg-light text-secondary border" style={{ fontSize: '.64rem' }}>
              เปลี่ยน อสม.
            </span>
          </div>
          <hr className="my-2 opacity-25" />
          <div
            className="btn btn-sm w-100 rounded-pill fw-bold d-flex align-items-center justify-content-center"
            style={{
              background: '#e0f2fe',
              color: '#0369a1',
              border: '2px solid #0284c7',
              fontSize: '.75rem',
              boxShadow: pulse ? '0 0 0 5px rgba(2,132,199,0.3)' : 'none',
              transition: 'all .3s',
            }}
          >
            <i className="fa-solid fa-location-crosshairs me-1" />
            บันทึกพิกัดบ้าน / เข้าคิว HOSxP
          </div>
        </div>

        <div className="alert alert-success py-2 px-3 mb-0 small" style={{ fontSize: '.7rem', borderRadius: 10 }}>
          <i className="fa-solid fa-satellite-dish me-1" />
          จับสัญญาณดาวเทียมสำเร็จ (ความแม่นยำ ±4 เมตร) และส่งเข้าคิว HOSxP แล้ว
        </div>
      </div>
    );
  }

  if (type === 'chronic-type') {
    return (
      <div className="p-3" style={{ fontSize: '.76rem' }}>
        <div className="border rounded-3 p-2 bg-white shadow-sm">
          <div className="d-flex justify-content-between mb-2">
            <strong className="text-primary">นายสมชาย ใจดี</strong>
            <span className="badge bg-light text-dark border">อายุ 58</span>
          </div>

          <div className="p-2 rounded-2 bg-light mb-2">
            <div className="text-muted" style={{ fontSize: '.65rem' }}>
              โรคประจำตัว (เลือกหลายโรคไขว้กันได้)
            </div>
            <div className="d-flex flex-wrap gap-1 mt-1">
              <span className="badge bg-primary">✓ ความดันโลหิตสูง</span>
              <span className="badge bg-primary">✓ เบาหวาน</span>
              <span className="badge bg-white text-dark border">+ โรคไต</span>
            </div>
          </div>

          <div className="mb-2">
            <div className="text-muted mb-1" style={{ fontSize: '.65rem' }}>
              สถานะตาม HOSxP
            </div>
            <div className="form-control form-control-sm mb-1" style={{ fontSize: '.72rem' }}>
              Type 1 — มีชื่อตามทะเบียนบ้านและอยู่จริง
            </div>
            <div className="form-control form-control-sm" style={{ fontSize: '.72rem' }}>
              9 — ไม่จำหน่าย (มีชีวิตและยังอยู่ในทะเบียน)
            </div>
          </div>

          <div
            className="btn btn-sm btn-primary w-100 fw-bold"
            style={{
              fontSize: '.73rem',
              boxShadow: pulse ? '0 0 0 4px rgba(37,99,235,0.35)' : 'none',
            }}
          >
            บันทึกประเภทอยู่อาศัยและสถานะจำหน่าย
          </div>
        </div>
      </div>
    );
  }

  if (type === 'screening-card') {
    return (
      <div className="p-3" style={{ fontSize: '.75rem' }}>
        <div className="border rounded-3 p-2 bg-white mb-2">
          <div className="fw-bold text-dark mb-1">
            <i className="fa-solid fa-smoking text-danger me-1" /> คัดกรองพฤติกรรมเสี่ยง
          </div>
          <div className="d-flex gap-1 mb-1">
            <span className="badge bg-success flex-fill py-1">บุหรี่: ไม่สูบ</span>
            <span className="badge bg-primary flex-fill py-1">สุรา: เลิกแล้ว</span>
          </div>
        </div>

        <div
          className="border rounded-3 p-2 bg-white"
          style={{
            borderColor: '#f59e0b',
            boxShadow: pulse ? '0 0 0 4px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          <div className="fw-bold mb-1" style={{ color: '#b45309' }}>
            <i className="fa-solid fa-fish me-1" /> คัดกรองพยาธิใบไม้ตับ (OV) (อายุ ≥ 15 ปี)
          </div>
          <div className="small text-muted mb-2" style={{ fontSize: '.67rem' }}>
            1. เคยตรวจอุจจาระ/ปัสสาวะหาพยาธิใบไม้ตับหรือไม่?
            <br />
            2. เคยมีประวัติกินปลาดิบ (ก้อยปลา/ปลาร้าดิบ/ส้มปลา) หรือไม่?
          </div>
          <div className="btn btn-sm btn-warning w-100 fw-bold" style={{ fontSize: '.72rem' }}>
            ✓ บันทึกผลคัดกรอง OV
          </div>
        </div>
      </div>
    );
  }

  if (type === 'transfer') {
    return (
      <div className="p-3" style={{ fontSize: '.75rem' }}>
        <div
          className="p-2 rounded-3 mb-2 border"
          style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}
        >
          <div className="fw-bold" style={{ color: '#b45309', fontSize: '.74rem' }}>
            📥 รายการรอยืนยันย้ายเข้าบ้าน (1 รายการ)
          </div>
          <div className="bg-white rounded-2 p-2 mt-1 border">
            <div className="fw-bold">
              <span className="badge bg-warning text-dark me-1">⏳ รอยืนยันย้ายเข้า</span>
              นายกิตติ ใจดี
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '.66rem' }}>
              ย้ายจาก: บ้าน 10 ม.1 → ย้ายเข้า: <strong className="text-primary">บ้าน 20 ม.2</strong>
            </div>
            <div className="d-flex gap-1 mt-2">
              <span
                className="btn btn-sm btn-success rounded-pill flex-fill py-1 fw-bold"
                style={{
                  fontSize: '.68rem',
                  boxShadow: pulse ? '0 0 0 4px rgba(22,163,74,0.35)' : 'none',
                }}
              >
                ✓ ยืนยันรับเข้าบ้าน
              </span>
              <span className="btn btn-sm btn-outline-danger rounded-pill py-1" style={{ fontSize: '.68rem' }}>
                ปฏิเสธ
              </span>
            </div>
          </div>
        </div>

        <div className="border rounded-3 p-2 bg-white small">
          <div className="fw-bold text-secondary" style={{ fontSize: '.68rem' }}>
            สรุปเงื่อนไขการย้ายบ้าน:
          </div>
          <div style={{ fontSize: '.66rem' }}>
            • <strong>ย้ายในหมู่ตัวเอง / เจ้าหน้าที่กดย้าย</strong> → ย้ายทันที
            <br />• <strong>อสม. กดย้ายข้ามหมู่</strong> → รอหมู่ปลายทางกดยืนยันรับเข้า
          </div>
        </div>
      </div>
    );
  }

  if (type === 'kpi') {
    return (
      <div className="p-3" style={{ fontSize: '.75rem' }}>
        <div className="fw-bold text-primary mb-2">
          <i className="fa-solid fa-heart-pulse me-1" /> คัดกรองรายบุคคล 4 KPI
        </div>
        <div className="d-flex flex-column gap-2">
          <div className="p-2 rounded-3 border bg-white d-flex justify-content-between align-items-center">
            <div>
              <strong>1. วัณโรค (TB)</strong>
              <div className="text-muted" style={{ fontSize: '.65rem' }}>
                กลุ่มเสี่ยง / ผู้สูงอายุ
              </div>
            </div>
            <span className="badge bg-success">ปกติ</span>
          </div>
          <div
            className="p-2 rounded-3 border bg-white d-flex justify-content-between align-items-center"
            style={{ boxShadow: pulse ? '0 0 0 3px rgba(37,99,235,0.3)' : 'none' }}
          >
            <div>
              <strong>2. มะเร็งลำไส้ใหญ่ (FIT Test)</strong>
              <div className="text-muted" style={{ fontSize: '.65rem' }}>
                อายุ 50–70 ปี
              </div>
            </div>
            <span className="btn btn-sm btn-primary py-0 px-2" style={{ fontSize: '.66rem' }}>
              บันทึกผล
            </span>
          </div>
          <div className="p-2 rounded-3 border bg-white d-flex justify-content-between align-items-center">
            <div>
              <strong>3. พยาธิใบไม้ตับ (OV)</strong>
              <div className="text-muted" style={{ fontSize: '.65rem' }}>
                อายุ 15 ปีขึ้นไป
              </div>
            </div>
            <span className="badge bg-success">ตรวจแล้ว</span>
          </div>
          <div className="p-2 rounded-3 border bg-white d-flex justify-content-between align-items-center">
            <div>
              <strong>4. พัฒนาการเด็ก (DSPM)</strong>
              <div className="text-muted" style={{ fontSize: '.65rem' }}>
                เด็กเล็ก 0–5 ปี
              </div>
            </div>
            <span className="badge bg-info text-dark">สมวัย</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3" style={{ fontSize: '.75rem' }}>
      <div className="fw-bold text-primary mb-2">
        <i className="fa-solid fa-map-location-dot me-1" /> แผนที่สุขภาพหลังคาบ้าน (GIS)
      </div>
      <div
        className="rounded-3 p-3 position-relative border mb-2"
        style={{
          height: 155,
          background: 'linear-gradient(135deg, #dcfce7 0%, #e0f2fe 100%)',
        }}
      >
        <div
          className="badge bg-success position-absolute shadow-sm"
          style={{ top: 24, left: 28, fontSize: '.68rem' }}
        >
          🟢 บ้าน 12 (ครบ)
        </div>
        <div
          className="badge bg-warning text-dark position-absolute shadow-sm"
          style={{ top: 68, right: 32, fontSize: '.68rem' }}
        >
          🟠 บ้าน 24/1 (รอ KPI)
        </div>
        <div
          className="badge bg-danger position-absolute shadow-sm"
          style={{
            bottom: 22,
            left: 55,
            fontSize: '.68rem',
            boxShadow: pulse ? '0 0 0 4px rgba(220,38,38,0.35)' : 'none',
          }}
        >
          🔴 บ้าน 39 (ยังไม่สำรวจ)
        </div>
      </div>
      <div className="d-flex justify-content-around small text-muted" style={{ fontSize: '.66rem' }}>
        <span>🟢 สำรวจ+KPI ครบ</span>
        <span>🟠 เหลือ KPI</span>
        <span>🔴 ยังไม่สำรวจ</span>
      </div>
    </div>
  );
}

export default function VhvGuidePage() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [tick, setTick] = useState(0);
  const [copiedNotice, setCopiedNotice] = useState('');

  const timerRef = useRef(null);
  const currentScene = SCENES[currentIdx];

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakText = useCallback(
    (text) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !voiceEnabled) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'th-TH';
        utter.rate = speechRate;
        const voices = window.speechSynthesis.getVoices();
        const thVoice = voices.find((v) => v.lang && v.lang.toLowerCase().includes('th'));
        if (thVoice) utter.voice = thVoice;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore speech synthesis errors on unsupported browsers
      }
    },
    [voiceEnabled, speechRate]
  );

  // Trigger voiceover when scene changes while playing
  useEffect(() => {
    setSceneProgress(0);
    if (isPlaying && voiceEnabled) {
      speakText(currentScene.voiceText);
    } else {
      stopSpeech();
    }
    return () => stopSpeech();
  }, [currentIdx, isPlaying, voiceEnabled, currentScene.voiceText, speakText, stopSpeech]);

  // Progress timer for auto-advancing scenes like a video player
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const stepMs = 250;
    const totalMs = currentScene.durationSec * 1000;
    timerRef.current = setInterval(() => {
      setTick((t) => t + 1);
      setSceneProgress((prev) => {
        const next = prev + (stepMs / totalMs) * 100;
        if (next >= 100) {
          setCurrentIdx((idx) => {
            if (idx < SCENES.length - 1) return idx + 1;
            setIsPlaying(false);
            return idx;
          });
          return 0;
        }
        return next;
      });
    }, stepMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentScene.durationSec]);

  // Subtle animation tick even when paused
  useEffect(() => {
    if (isPlaying) return;
    const id = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(id);
  }, [isPlaying]);

  const handleTogglePlay = () => {
    if (!isPlaying && currentIdx === SCENES.length - 1 && sceneProgress >= 95) {
      setCurrentIdx(0);
      setSceneProgress(0);
    }
    setIsPlaying((p) => !p);
  };

  const handleSelectScene = (index) => {
    setCurrentIdx(index);
    setSceneProgress(0);
  };

  const handleShareLine = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = '🎬 วิดีโอสอนการใช้งานระบบสำรวจสุขภาพโนนสว่าง (สำหรับ อสม. ผ่าน LINE LIFF)';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: shareUrl });
        return;
      } catch {
        // fallback to copy
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopiedNotice('คัดลอกลิงก์คู่มือแล้ว สามารถวางส่งในกลุ่ม LINE อสม. ได้เลย');
      setTimeout(() => setCopiedNotice(''), 3500);
    }
  };

  return (
    <>
      <TopBar />
      <main className="container py-4" style={{ maxWidth: 960 }}>
        {/* Header */}
        <div
          className="card border-0 shadow-sm mb-3 text-white overflow-hidden"
          style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #065f46 0%, #047857 55%, #0ea5e9 100%)',
          }}
        >
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <span className="badge bg-warning text-dark mb-2">
                  <i className="fa-brands fa-line me-1" /> คู่มือวิดีโอ Interactive สำหรับ อสม.
                </span>
                <h1 className="h4 fw-bold mb-1">
                  วิดีโอสอนการใช้งานระบบสำรวจสุขภาพ (ผ่าน LINE LIFF)
                </h1>
                <p className="mb-0 small text-white-50">
                  รพ.สต.บ้านโนนสว่าง • กดปุ่ม ▶ เล่นวิดีโอเพื่อฟังเสียงบรรยายภาษาไทยและดูภาพจำลองทีละขั้นตอน
                </p>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleShareLine}
                  className="btn btn-sm btn-light fw-bold rounded-pill px-3"
                >
                  <i className="fa-solid fa-share-nodes me-1 text-success" /> แชร์เข้ากลุ่ม LINE อสม.
                </button>
                <Link href="/login" className="btn btn-sm btn-warning fw-bold rounded-pill px-3">
                  <i className="fa-solid fa-right-to-bracket me-1" /> ไปหน้าเข้าใช้งานจริง
                </Link>
              </div>
            </div>
            {copiedNotice && (
              <div className="alert alert-light py-2 px-3 mt-3 mb-0 small text-success fw-bold">
                <i className="fa-solid fa-circle-check me-1" /> {copiedNotice}
              </div>
            )}
          </div>
        </div>

        {/* Video Player Area */}
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 18 }}>
          <div className="card-body p-3 p-md-4">
            {/* Player Top Control Bar */}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pb-3 mb-3 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className={`btn ${isPlaying ? 'btn-danger' : 'btn-success'} rounded-pill px-4 fw-bold shadow-sm`}
                >
                  <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} me-2`} />
                  {isPlaying ? 'หยุดชั่วคราว' : '▶ เล่นวิดีโอพร้อมเสียงบรรยาย'}
                </button>
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => handleSelectScene(Math.max(0, currentIdx - 1))}
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                >
                  <i className="fa-solid fa-backward-step" /> ก่อนหน้า
                </button>
                <button
                  type="button"
                  disabled={currentIdx === SCENES.length - 1}
                  onClick={() => handleSelectScene(Math.min(SCENES.length - 1, currentIdx + 1))}
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                >
                  ถัดไป <i className="fa-solid fa-forward-step" />
                </button>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVoiceEnabled((v) => !v)}
                  className={`btn btn-sm rounded-pill px-3 ${
                    voiceEnabled ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                >
                  <i className={`fa-solid ${voiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'} me-1`} />
                  {voiceEnabled ? 'เสียงบรรยาย: เปิด' : 'เสียงบรรยาย: ปิด'}
                </button>
                <select
                  aria-label="ความเร็วเสียงบรรยาย"
                  className="form-select form-select-sm"
                  style={{ width: 95 }}
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                >
                  <option value={0.9}>ช้า (0.9x)</option>
                  <option value={1.0}>ปกติ (1x)</option>
                  <option value={1.15}>เร็ว (1.15x)</option>
                </select>
              </div>
            </div>

            {/* Scene Progress Timeline */}
            <div className="mb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>
                  กำลังแสดง: <strong className="text-dark">{currentScene.badge}</strong> — {currentScene.title}
                </span>
                <span>
                  ฉากที่ {currentIdx + 1} จาก {SCENES.length}
                </span>
              </div>
              <div className="progress" style={{ height: 8, borderRadius: 8 }}>
                <div
                  className="progress-bar bg-success"
                  role="progressbar"
                  style={{
                    width: `${((currentIdx + sceneProgress / 100) / SCENES.length) * 100}%`,
                    transition: 'width .25s linear',
                  }}
                />
              </div>
            </div>

            {/* Main Split View: Left = Phone Screen Simulation, Right = Step-by-Step Explanation */}
            <div className="row g-4 align-items-center">
              {/* Mobile Phone Frame */}
              <div className="col-12 col-md-5">
                <div
                  className="mx-auto shadow"
                  style={{
                    maxWidth: 300,
                    borderRadius: 28,
                    border: '7px solid #1e293b',
                    background: '#f8fafc',
                    overflow: 'hidden',
                  }}
                >
                  {/* Phone Status Bar */}
                  <div
                    className="d-flex justify-content-between align-items-center px-3 py-1 text-white"
                    style={{ background: '#0f172a', fontSize: '.68rem' }}
                  >
                    <span>LINE LIFF</span>
                    <span>5G • 100%</span>
                  </div>
                  <PhoneMockupScreen type={currentScene.mockup} tick={tick} />
                </div>
              </div>

              {/* Explanation & Subtitle Panel */}
              <div className="col-12 col-md-7">
                <span className="badge bg-success-subtle text-success mb-2">{currentScene.badge}</span>
                <h2 className="h5 fw-bold text-dark mb-3">{currentScene.title}</h2>

                {/* Voiceover Subtitle Box */}
                <div
                  className="p-3 rounded-3 mb-3 border"
                  style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}
                >
                  <div className="small fw-bold text-success mb-1">
                    <i className="fa-solid fa-microphone-lines me-1" /> คำบรรยาย (แตะปุ่มฟังซ้ำได้):
                  </div>
                  <p className="mb-2 small text-dark" style={{ lineHeight: 1.65 }}>
                    &ldquo;{currentScene.voiceText}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => speakText(currentScene.voiceText)}
                    className="btn btn-sm btn-outline-success rounded-pill px-3"
                    style={{ fontSize: '.75rem' }}
                  >
                    <i className="fa-solid fa-rotate-right me-1" /> ฟังเสียงอธิบายบทนี้อีกครั้ง
                  </button>
                </div>

                {/* Actionable Steps */}
                <h3 className="h6 fw-bold mb-2">ขั้นตอนการปฏิบัติ:</h3>
                <ol className="ps-3 mb-3 small" style={{ lineHeight: 1.8 }}>
                  {currentScene.steps.map((step, i) => (
                    <li key={i} className="mb-1">
                      {step}
                    </li>
                  ))}
                </ol>

                <div className="alert alert-warning py-2 px-3 mb-0 small" style={{ borderRadius: 10 }}>
                  <i className="fa-solid fa-lightbulb me-1" /> <strong>ข้อแนะนำ:</strong> {currentScene.tip}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Playlist Selector */}
        <div className="card border-0 shadow-sm" style={{ borderRadius: 18 }}>
          <div className="card-body p-3 p-md-4">
            <h2 className="h6 fw-bold mb-3">
              <i className="fa-solid fa-list-ol me-2 text-primary" />
              สารบัญบทเรียนทั้งหมด (แตะเลือกบทที่ต้องการดูได้ทันที)
            </h2>
            <div className="row g-2">
              {SCENES.map((scene, index) => {
                const active = index === currentIdx;
                return (
                  <div key={scene.id} className="col-12 col-md-6">
                    <button
                      type="button"
                      onClick={() => handleSelectScene(index)}
                      className={`w-100 text-start p-3 rounded-3 border d-flex align-items-center justify-content-between gap-2 ${
                        active ? 'border-primary bg-primary-subtle' : 'bg-white'
                      }`}
                      style={{ transition: 'all .15s' }}
                    >
                      <div>
                        <div className="small fw-bold text-primary">{scene.badge}</div>
                        <div className="fw-semibold small text-dark">{scene.title}</div>
                      </div>
                      <span className={`badge rounded-pill ${active ? 'bg-primary' : 'bg-light text-secondary border'}`}>
                        {active ? 'กำลังเล่น' : 'ดูบทนี้'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
