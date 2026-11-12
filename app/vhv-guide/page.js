'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';

const SCENES = [
  {
    id: 1,
    badge: 'บทที่ 1 / 6',
    title: 'เข้าใช้งานผ่าน LINE LIFF & ผูกบัญชีครั้งแรก',
    durationSec: 16,
    audioSrc: '/audio/guide/scene-1.mp3',
    voiceText:
      'บทที่หนึ่ง การเข้าสู่ระบบผ่านไลน์ลิฟค่ะ สำหรับพี่น้อง ออ-สอ-มอ เมื่อเปิดลิงก์ในกลุ่มไลน์แล้ว ให้กดปุ่ม เข้าสู่ระบบด้วยไลน์ หากเป็นการใช้งานครั้งแรก ให้กดเลือก ออ-สอ-มอ และกรอกเลขบัตรประชาชนสิบสามหลัก แล้วกดปุ่ม ยืนยันและผูกบัญชีไลน์ ครั้งต่อไปจะสามารถกดเข้าใช้งานได้ทันทีค่ะ',
    displayText:
      'บทที่ 1 การเข้าสู่ระบบผ่าน LINE LIFF: สำหรับพี่น้อง อสม. เมื่อเปิดลิงก์ในกลุ่ม LINE แล้ว ให้กดปุ่ม "เข้าสู่ระบบด้วย LINE" หากเป็นการใช้งานครั้งแรก ให้เลือก "อสม." แล้วกรอกเลขบัตรประชาชน 13 หลัก จากนั้นกดปุ่ม "ยืนยันและผูกบัญชี LINE" ครั้งต่อไปเมื่อกดเข้าผ่าน LINE ระบบจะเข้าใช้งานได้ทันทีโดยไม่ต้องกรอกรหัสอีกค่ะ',
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
    badge: 'บทที่ 2 / 6',
    title: 'หน้า "บ้านที่ฉันรับผิดชอบ" เลือกบ้านลงสำรวจ',
    durationSec: 14,
    audioSrc: '/audio/guide/scene-2.mp3',
    voiceText:
      'บทที่สอง หน้าบ้านที่ฉันรับผิดชอบค่ะ เมื่อ ออ-สอ-มอ เข้าสู่ระบบแล้ว จะเห็นรายชื่อบ้านในความรับผิดชอบทั้งหมด สามารถกดดูงานที่ยังไม่ครบ แล้วแตะเลือกบ้านเลขที่ที่ต้องการ เพื่อเปิดดูรายชื่อคนในบ้านได้ทันทีค่ะ',
    displayText:
      'บทที่ 2 หน้าบ้านที่ฉันรับผิดชอบ: เมื่อ อสม. เข้าสู่ระบบแล้ว จะเห็นรายชื่อบ้านในความรับผิดชอบทั้งหมด สามารถกดเลือกดู "งานที่ยังไม่ครบ" แล้วแตะเลือกบ้านเลขที่ที่ต้องการ เพื่อเปิดดูรายชื่อสมาชิกในบ้านได้ทันทีค่ะ',
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
    badge: 'บทที่ 3 / 6',
    title: 'ปักหมุดพิกัดหลังคาบ้าน (GPS) หน้าบ้านจริง',
    durationSec: 13,
    audioSrc: '/audio/guide/scene-3.mp3',
    voiceText:
      'บทที่สาม การปักหมุดพิกัดหลังคาบ้านด้วยจีพีเอสค่ะ ให้ ออ-สอ-มอ ยืนอยู่บริเวณหน้าบ้านจริง แล้วกดปุ่ม บันทึกพิกัดบ้านเข้าคิวฮอสเอ็กซ์พี หากมือถือถาม ให้กดอนุญาตให้เข้าถึงตำแหน่ง พิกัดจะถูกส่งเข้าคิวให้เจ้าหน้าที่ตรวจสอบต่อไปค่ะ',
    displayText:
      'บทที่ 3 การปักหมุดพิกัดหลังคาบ้าน (GPS): ให้ อสม. ยืนอยู่บริเวณหน้าบ้านจริงที่กำลังสำรวจ แล้วกดปุ่ม "บันทึกพิกัดบ้าน / เข้าคิว HOSxP" หากมือถือถามสิทธิ์ ให้กด "อนุญาต" เพื่อให้ระบบจับพิกัดดาวเทียมและส่งเข้าคิวให้เจ้าหน้าที่ตรวจสอบต่อไปค่ะ',
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
    badge: 'บทที่ 4 / 6',
    title: 'บันทึกโรคประจำตัว (เลือกหลายโรคได้) & สถานะ Type 1–4',
    durationSec: 18,
    audioSrc: '/audio/guide/scene-4.mp3',
    voiceText:
      'บทที่สี่ การบันทึกโรคประจำตัวและประเภทอยู่อาศัยค่ะ ในการ์ดของแต่ละคน ออ-สอ-มอ สามารถกดเลือกโรคประจำตัวได้หลายโรคพร้อมกัน หรือพิมพ์ระบุเพิ่มได้ จากนั้นเลือกประเภทอยู่อาศัย ไทป์หนึ่งถึงสี่ และสถานะจำหน่าย แล้วกดปุ่มสีน้ำเงินเพื่อบันทึกค่ะ',
    displayText:
      'บทที่ 4 การบันทึกโรคประจำตัวและประเภทอยู่อาศัย: ในการ์ดของแต่ละคน อสม. สามารถกดเลือกโรคประจำตัวได้หลายโรคพร้อมกัน (โรคไขว้) หรือพิมพ์ระบุเพิ่มได้ จากนั้นเลือกประเภทอยู่อาศัย (Type 1–4) และสถานะจำหน่าย แล้วกดปุ่มสีน้ำเงิน "บันทึกประเภทอยู่อาศัยและสถานะจำหน่าย" ค่ะ',
    steps: [
      'เลือก "สถานะในบ้าน" (เช่น เจ้าบ้าน, ผู้อาศัย, บุตร/หลาน)',
      'กดปุ่ม "โรคประจำตัว" → ติ๊กเลือกได้หลายโรคพร้อมกัน (โรคไขว้) หรือพิมพ์ระบุโรคอื่นๆ → กดบันทึกโรค',
      'เลือก "ประเภทอยู่อาศัย" (Type 1 มีชื่ออยู่จริง / Type 2 มีชื่อไม่อยู่ / Type 3 มาอาศัยไม่มีชื่อในทะเบียน / Type 4 มีชื่อนอกเขตและไม่ได้อยู่ในเขต)',
      'เลือก "สถานะจำหน่าย" (ปกติเลือก 9 = ไม่จำหน่าย) แล้วกดปุ่มสีน้ำเงินเพื่อบันทึก',
    ],
    tip: 'หากผู้ป่วยไม่มีโรคประจำตัว ให้ติ๊ก "ปกติ (ไม่มีโรค)" ระบบจะล้างรายการโรคอื่นให้อัตโนมัติ',
    mockup: 'chronic-type',
  },
  {
    id: 5,
    badge: 'บทที่ 5 / 6',
    title: 'การย้ายบ้านในหมู่ & คิวยืนยันย้ายข้ามหมู่',
    durationSec: 17,
    audioSrc: '/audio/guide/scene-5.mp3',
    voiceText:
      'บทที่ห้า การย้ายบ้านในทะเบียนสำรวจค่ะ หากคนในบ้านย้ายที่อยู่ ให้กดปุ่ม ย้ายบ้านในทะเบียนสำรวจ แล้วเลือกหมู่และบ้านเลขที่ใหม่ ถ้าย้ายในหมู่เดิมจะย้ายทันที แต่ถ้าย้ายข้ามหมู่ ระบบจะส่งเข้าคิว เพื่อให้ ออ-สอ-มอ หมู่ปลายทาง หรือเจ้าหน้าที่กดยืนยันรับเข้าบ้านค่ะ',
    displayText:
      'บทที่ 5 การย้ายบ้านในทะเบียนสำรวจ: หากคนในบ้านย้ายที่อยู่ ให้กดปุ่ม "ย้ายบ้านในทะเบียนสำรวจ" แล้วเลือกหมู่และบ้านเลขที่ใหม่ที่มีอยู่ในระบบ ถ้าย้ายในหมู่เดิมจะย้ายทันที แต่ถ้าย้ายข้ามหมู่ ระบบจะส่งเข้าคิว "⏳ รอยืนยันย้ายเข้า" เพื่อให้ อสม. หมู่ปลายทาง หรือเจ้าหน้าที่กดยืนยันรับเข้าบ้านค่ะ',
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
    id: 6,
    badge: 'บทที่ 6 / 6',
    title: 'แผนที่สุขภาพหลังคาบ้าน 3 สี',
    durationSec: 16,
    audioSrc: null, // Old recording describes screening, not this map chapter.
    voiceText:
      'บทที่หก แผนที่สุขภาพหลังคาบ้านค่ะ เปิดเมนูแผนที่ แล้วเลือกโหมดสถานะงานสำรวจ สีเขียวหมายถึงครบ สีส้มหมายถึงรอเคพีไอ สีแดงหมายถึงยังไม่สำรวจ ซูมเข้าแล้วแตะหมุดบ้านเพื่อดูรายละเอียดและเปิดหน้าสำรวจค่ะ ตรวจคำอธิบายสีทุกครั้ง เพราะโหมดโรคใช้สีต่างกันนะคะ',
    displayText:
      'แผนที่สถานะงาน: 🟢 เขียว = ครบ, 🟠 ส้ม = รอ KPI, 🔴 แดง = ยังไม่สำรวจ แตะหมุดเพื่อดูรายละเอียดและเปิดหน้าสำรวจ สีในโหมดโรคมีความหมายต่างกัน',
    steps: [
      'เปิดแผนที่ เลือกหมู่บ้านและโหมดสถานะงานสำรวจ',
      'อ่านคำอธิบายสี: เขียวครบ / ส้มรอ KPI / แดงยังไม่สำรวจ',
      'ซูมเข้า แตะหมุดบ้าน แล้วเปิดหน้าสำรวจเพื่อทำงานต่อ',
    ],
    tip: 'ตรวจชื่อโหมดและคำอธิบายสีก่อนใช้ติดตามงาน',
    mockup: 'health-map',
  },
];

function PhoneMockupScreen({ type, tick }) {
  const pulse = tick % 2 === 0;
  if (type === 'health-map') return <div className="p-4"><h3 className="h6">แผนที่สถานะงาน</h3><p>🏠 🟢 ครบ</p><p>🏠 🟠 รอ KPI</p><p>🏠 🔴 ยังไม่สำรวจ</p><small>แตะหมุดเพื่อเปิดรายละเอียดบ้าน</small></div>;

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

export default function VhvGuidePage() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [tick, setTick] = useState(0);
  const [copiedNotice, setCopiedNotice] = useState('');

  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const currentScene = SCENES[currentIdx];

  // Stop any active audio and speech synthesis
  const stopAudio = useCallback(() => { generationRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const [audioError, setAudioError] = useState('');
  const [narrationEnded, setNarrationEnded] = useState(false);
  const generationRef = useRef(0);
  const speechRateRef = useRef(speechRate);
  speechRateRef.current = speechRate;
  const playAudioForScene = useCallback((scene) => {
    stopAudio();
    setNarrationEnded(false);
    setSceneProgress(0);
    setAudioError('');
    if (!voiceEnabled) return;
    const generation = generationRef.current;
    const current = () => generation === generationRef.current;
    const done = () => { if (current()) { setSceneProgress(100); setNarrationEnded(true); } };
    const fail = () => { if (current()) { setAudioError('เล่นเสียงไม่สำเร็จ กรุณากดฟังซ้ำ'); setIsPlaying(false); } };
    const fallback = () => {
      if (!current()) return;
      if (!('speechSynthesis' in window)) { fail(); return; }
      const utter = new SpeechSynthesisUtterance(scene.voiceText);
      utter.lang = 'th-TH';
      utter.rate = speechRateRef.current;
      utter.onend = done;
      utter.onerror = fail;
      window.speechSynthesis.speak(utter);
    };
    if (!scene.audioSrc) { fallback(); return; }
    const audio = new Audio(scene.audioSrc);
    audioRef.current = audio;
    audio.playbackRate = speechRateRef.current;
    audio.onended = done;
    audio.ontimeupdate = () => {
      if (current() && Number.isFinite(audio.duration) && audio.duration > 0)
        setSceneProgress(audio.currentTime / audio.duration * 100);
    };
    audio.play().catch(fallback);
  }, [voiceEnabled, stopAudio]);

  useEffect(() => {
    if (!isPlaying || !voiceEnabled || !narrationEnded) return;
    if (currentIdx < SCENES.length - 1) {
      setNarrationEnded(false);
      setCurrentIdx(currentIdx + 1);
    } else setIsPlaying(false);
  }, [isPlaying, voiceEnabled, narrationEnded, currentIdx]);
// Play audio when current scene changes while playing
  useEffect(() => {
    if (isPlaying) {
      playAudioForScene(currentScene);
    } else {
      stopAudio();
    }
    return () => stopAudio();
  }, [currentIdx, isPlaying, currentScene, playAudioForScene, stopAudio]);

  // Handle audio rate changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speechRate;
    }
  }, [speechRate]);

  // Progress timer for auto-advancing scenes
  useEffect(() => {
    if (!isPlaying || voiceEnabled) {
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
  }, [isPlaying, voiceEnabled, currentScene.durationSec]);

  // Subtle visual pulse tick
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
        // fallback
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
                  รพ.สต.บ้านโนนสว่าง • กดปุ่ม ▶ เล่นวิดีโอเพื่อฟังเสียงบรรยายและดูภาพจำลองหน้าจอทีละขั้นตอน
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
                  {isPlaying ? 'หยุดเล่น' : '▶ เล่นวิดีโอพร้อมเสียงบรรยาย'}
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
                  onClick={() => {
                    const next = !voiceEnabled;
                    setVoiceEnabled(next);
                    
                    
                  }}
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

            {audioError && <div role="alert" className="alert alert-warning">{audioError}</div>}
            {/* Scene Progress Timeline */}
            <div className="mb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>
                  กำลังแสดง: <strong className="text-dark">{currentScene.badge}</strong> — {currentScene.title}
                </span>
                <span>
                  บทที่ {currentIdx + 1} จาก {SCENES.length}
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
                    &ldquo;{currentScene.displayText}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => playAudioForScene(currentScene)}
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
