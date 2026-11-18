'use client';
import { useState } from 'react';
import {
  CHRONIC_CHOICES,
  NORMAL,
  chronicDraft,
  serializeChronic,
  parseChronicList,
  diseaseCount,
} from '@/lib/chronic.mjs';

export default function ChronicEditor({ value, onSave, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => chronicDraft(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saved = parseChronicList(value);
  const count = diseaseCount(saved);
  const isNormal = chronicDraft(value).normal;
  const isUnspecified = !saved.length && !isNormal;

  function toggle(name) {
    setDraft((d) => ({
      ...d,
      normal: false,
      selected: d.selected.includes(name)
        ? d.selected.filter((x) => x !== name)
        : [...d.selected, name],
    }));
  }

  async function quickSaveNormal() {
    if (disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      const ok = await onSave(NORMAL);
      if (ok === false) {
        setError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        return;
      }
      setOpen(false);
    } catch {
      setError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      if ((await onSave(serializeChronic(draft))) === false) {
        setError('บันทึกไม่สำเร็จ แบบร่างยังอยู่ กรุณาตรวจข้อมูลแล้วลองใหม่');
        return;
      }
      setOpen(false);
    } catch {
      setError('บันทึกไม่สำเร็จ แบบร่างยังอยู่ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* แสดงสถานะโรคปัจจุบันตัวใหญ่ชัดเจน */}
      <div className="d-flex flex-wrap align-items-center gap-2 my-2">
        {saved.length ? (
          saved.map((name) => (
            <span
              key={name}
              className="badge text-wrap px-3 py-2"
              style={{
                fontSize: '.92rem',
                borderRadius: 10,
                background: ['#285d91', '#8b4d85', '#956814', '#516f64'][
                  Math.max(0, CHRONIC_CHOICES.indexOf(name)) % 4
                ],
              }}
            >
              💊 {name}
            </span>
          ))
        ) : isNormal ? (
          <span
            className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2"
            style={{ fontSize: '.92rem', borderRadius: 10 }}
          >
            ✅ {NORMAL}
          </span>
        ) : (
          <span
            className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"
            style={{ fontSize: '.92rem', borderRadius: 10 }}
          >
            ⚠️ ยังไม่ระบุโรคประจำตัว
          </span>
        )}
        {count >= 2 && (
          <span className="badge bg-danger px-2 py-2" style={{ fontSize: '.82rem', borderRadius: 8 }}>
            มีโรคเรื้อรังร่วม {count} โรค
          </span>
        )}
      </div>

      {/* ปุ่มกดขนาดใหญ่สำหรับ อสม. */}
      <div className="d-flex flex-wrap gap-2 mt-2">
        {(isUnspecified || saved.length > 0) && !open && (
          <button
            type="button"
            className="btn btn-outline-success fw-bold flex-grow-1"
            style={{ minHeight: 46, fontSize: '.95rem', borderRadius: 12 }}
            disabled={disabled || busy}
            onClick={quickSaveNormal}
          >
            {busy ? 'กำลังบันทึก…' : '✅ กดยืนยันว่า “ปกติ (ไม่มีโรค)”'}
          </button>
        )}
        <button
          type="button"
          className={`btn fw-bold flex-grow-1 ${
            open ? 'btn-secondary' : 'btn-outline-primary'
          }`}
          style={{ minHeight: 46, fontSize: '.95rem', borderRadius: 12 }}
          aria-expanded={open}
          disabled={disabled || busy}
          onClick={() => {
            if (!open) {
              setDraft(chronicDraft(value));
              setError('');
            }
            setOpen(!open);
          }}
        >
          {open ? 'ปิดหน้าต่างเลือกโรค ▲' : '💊 เลือก / แก้ไขโรคประจำตัว ▼'}
        </button>
      </div>

      {error && !open && (
        <p role="alert" className="text-danger small mt-2 mb-0">
          {error}
        </p>
      )}

      {/* แผงเลือกโรคประจำตัว ปุ่มใหญ่ กดง่าย */}
      {open && (
        <fieldset
          className="border rounded-3 p-3 mt-2 bg-white shadow-sm"
          disabled={disabled || busy}
        >
          <legend className="small fw-bold text-dark float-none w-auto px-1 mb-2">
            แตะเลือกโรคที่เป็น (เลือกได้มากกว่า 1 โรค)
          </legend>
          <div className="row g-2">
            <div className="col-12">
              <button
                type="button"
                aria-pressed={draft.normal}
                className={
                  'btn w-100 fw-bold text-start px-3 ' +
                  (draft.normal ? 'btn-success' : 'btn-outline-success')
                }
                style={{ minHeight: 48, fontSize: '.95rem', borderRadius: 10 }}
                onClick={() => setDraft({ normal: !draft.normal, selected: [], other: '' })}
              >
                {draft.normal ? '✅ ' : '⬜ '}
                {NORMAL}
              </button>
            </div>
            {CHRONIC_CHOICES.map((name) => {
              const active = draft.selected.includes(name);
              return (
                <div key={name} className="col-12 col-sm-6">
                  <button
                    type="button"
                    aria-pressed={active}
                    className={
                      'btn w-100 fw-semibold text-start px-3 ' +
                      (active ? 'btn-primary' : 'btn-outline-primary')
                    }
                    style={{ minHeight: 48, fontSize: '.92rem', borderRadius: 10 }}
                    onClick={() => toggle(name)}
                  >
                    {active ? '✅ ' : '⬜ '}
                    {name}
                  </button>
                </div>
              );
            })}
          </div>

          <label className="d-block mt-3 fw-semibold small">
            โรคอื่นๆ นอกเหนือจากปุ่มด้านบน (ถ้ามี)
            <input
              className="form-control mt-1"
              style={{ minHeight: 44, fontSize: '.95rem' }}
              value={draft.other}
              maxLength={500}
              placeholder="เช่น เกาต์, ไทรอยด์ (คั่นด้วยลูกน้ำ)"
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  other: e.target.value,
                  normal: e.target.value.trim() ? false : d.normal,
                }))
              }
            />
          </label>

          {error && (
            <p role="alert" className="text-danger small mt-2 mb-0">
              {error}
            </p>
          )}

          <div className="d-flex gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary fw-bold flex-grow-1"
              style={{ minHeight: 48, fontSize: '1rem', borderRadius: 12 }}
              onClick={save}
            >
              {busy ? 'กำลังบันทึก…' : '💾 บันทึกโรคประจำตัว'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary fw-semibold px-3"
              style={{ minHeight: 48, borderRadius: 12 }}
              onClick={() => setOpen(false)}
            >
              ยกเลิก
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
