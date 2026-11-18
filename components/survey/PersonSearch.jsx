'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PersonSearch({ onOpenHouse, busy }) {
  const [mode, setMode] = useState('name');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const version = useRef(0);

  function reset() {
    version.current++;
    setRows(null);
    setMessage('');
    setLoading(false);
  }

  async function search(e) {
    e.preventDefault();
    const q = query.trim();
    const id = ++version.current;
    setRows(null);
    setMessage('');
    const digits = q.replace(/[\s-]/g, '');
    if (mode === 'cid' && !/^\d{13}$/.test(digits)) {
      setMessage('กรุณาระบุเลขบัตรประชาชนครบ 13 หลัก');
      return;
    }
    if (mode === 'name' && (q.length < 2 || q.length > 100)) {
      setMessage('กรุณาพิมพ์ชื่อหรือนามสกุลอย่างน้อย 2 ตัวอักษร');
      return;
    }
    setLoading(true);
    try {
      let request = supabase
        .from('population')
        .select('person_id,title,fname,lname,cid,house,moo')
        .order('fname')
        .order('person_id')
        .limit(21);
      if (mode === 'cid') request = request.eq('cid', digits);
      else
        for (const word of q.split(/\s+/)) {
          const pattern = '%' + word.replace(/[\\%_]/g, '\\$&') + '%';
          const quoted = JSON.stringify(pattern);
          request = request.or(`fname.ilike.${quoted},lname.ilike.${quoted}`);
        }
      const { data, error } = await request;
      if (id !== version.current) return;
      if (error) throw error;
      setRows((data || []).slice(0, 20));
      setMessage(
        data?.length > 20
          ? 'พบมากกว่า 20 คน — กรุณาพิมพ์ชื่อหรือนามสกุลให้ละเอียดขึ้น'
          : data?.length
          ? 'แตะปุ่ม “เปิดบ้านนี้” ที่รายชื่อด้านล่างเพื่อเข้าสำรวจ'
          : 'ไม่พบรายชื่อในหมู่บ้านที่คุณรับผิดชอบ'
      );
    } catch {
      if (id === version.current) setMessage('ค้นหาไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      if (id === version.current) setLoading(false);
    }
  }

  return (
    <section
      className="card border-0 shadow-sm mb-4"
      style={{ borderRadius: 16 }}
    >
      <div className="card-body p-3 p-md-4">
        <h2 className="h5 fw-bold mb-1">👤 ค้นหาจากชื่อคน หรือเลขบัตร</h2>
        <p className="small text-muted mb-3">
          ใช้เมื่อจำเลขที่บ้านไม่ได้ — พิมพ์ชื่อแล้วกดเปิดบ้านของคนนั้นได้ทันที
        </p>

        {/* ปุ่มสลับโหมดค้นหา ชื่อ vs เลขบัตร */}
        <div className="d-flex gap-2 mb-3">
          <button
            type="button"
            className={`btn fw-bold flex-grow-1 ${
              mode === 'name' ? 'btn-primary' : 'btn-outline-primary'
            }`}
            style={{ minHeight: 44, borderRadius: 12, fontSize: '.95rem' }}
            onClick={() => {
              reset();
              setMode('name');
              setQuery('');
            }}
          >
            🔤 ค้นด้วยชื่อ-นามสกุล
          </button>
          <button
            type="button"
            className={`btn fw-bold flex-grow-1 ${
              mode === 'cid' ? 'btn-primary' : 'btn-outline-primary'
            }`}
            style={{ minHeight: 44, borderRadius: 12, fontSize: '.95rem' }}
            onClick={() => {
              reset();
              setMode('cid');
              setQuery('');
            }}
          >
            🪪 ค้นด้วยเลขบัตร 13 หลัก
          </button>
        </div>

        <form onSubmit={search} className="row g-2">
          <div className="col-12 col-md-8">
            <label htmlFor="survey-person-query" className="visually-hidden">
              คำค้น
            </label>
            <input
              id="survey-person-query"
              className="form-control fw-semibold"
              style={{ minHeight: 50, fontSize: '1.08rem', borderRadius: 12 }}
              value={query}
              maxLength={100}
              inputMode={mode === 'cid' ? 'numeric' : 'text'}
              autoComplete="off"
              placeholder={
                mode === 'cid'
                  ? 'พิมพ์เลขบัตรประชาชน 13 หลัก...'
                  : 'พิมพ์ชื่อ หรือ นามสกุล (ไม่ต้องใส่ นาย/นาง)...'
              }
              onChange={(e) => {
                reset();
                setQuery(e.target.value);
              }}
            />
          </div>
          <div className="col-12 col-md-4">
            <button
              className="btn btn-primary w-100 fw-bold"
              style={{ minHeight: 50, fontSize: '1.02rem', borderRadius: 12 }}
              disabled={loading || busy}
            >
              {loading ? 'กำลังค้นหา…' : '🔍 ค้นหารายชื่อ'}
            </button>
          </div>
        </form>

        {message && (
          <p className="small fw-semibold text-primary mt-2 mb-0" role="status">
            {message}
          </p>
        )}

        {rows?.map((p) => (
          <div
            key={p.person_id}
            className="border rounded-3 p-3 mt-2 bg-light d-flex flex-wrap gap-2 justify-content-between align-items-center"
          >
            <div>
              <strong style={{ fontSize: '1.02rem' }}>
                {p.title}
                {p.fname} {p.lname}
              </strong>
              <div className="small text-muted mt-1">
                🏡 บ้านเลขที่ <strong className="text-dark">{p.house || 'ยังไม่ระบุ'}</strong> หมู่{' '}
                <strong className="text-dark">{p.moo || 'ยังไม่ระบุ'}</strong> · เลขบัตร •••••••••
                {String(p.cid || '').slice(-4)}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary fw-bold px-3"
              style={{ minHeight: 44, borderRadius: 12 }}
              disabled={busy || !p.house || !p.moo}
              onClick={() => onOpenHouse(String(p.moo), String(p.house))}
            >
              🏠 เปิดบ้านนี้ ›
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
