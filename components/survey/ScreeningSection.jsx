'use client';
import { useId } from 'react';

export default function ScreeningSection({ title, icon, titleClassName = 'text-muted', badge, open, onToggle, hasData, disabled, children }) {
  const id = useId();
  return <section className="risk-section mt-3 border-top pt-3">
    <div className="d-flex align-items-center justify-content-between gap-2">
      <div><span className={`small fw-bold ${titleClassName}`}><i className={`fa-solid ${icon} me-1`} />{title}</span>{badge}</div>
      <button type="button" className="btn btn-outline-secondary risk-toggle-btn" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} /> {hasData ? 'แก้ไข' : 'บันทึก'}
      </button>
    </div>
    <div id={id} className={`risk-body ${open ? 'open' : ''}`} hidden={!open}>{children}</div>
  </section>;
}
