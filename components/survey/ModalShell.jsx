'use client';
import { useId } from 'react';

export default function ModalShell({ title, icon, onClose, footer, children, variant = 'primary', scrollable = false, zIndex = 1055, bodyClassName = '' }) {
  const titleId = useId();
  const warning = variant === 'warning';
  return <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ background: 'rgba(0,0,0,.5)', zIndex }}>
    <div className={`modal-dialog modal-dialog-centered ${scrollable ? 'modal-dialog-scrollable' : ''}`}>
      <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div className={`modal-header ${warning ? 'bg-warning text-dark' : 'text-white'}`} style={warning ? undefined : { background: 'var(--primary)' }}>
          <h5 id={titleId} className="modal-title fw-bold"><i className={`fa-solid ${icon} me-2`} />{title}</h5>
          <button type="button" className={`btn-close ${warning ? '' : 'btn-close-white'}`} aria-label="ปิด" onClick={onClose} />
        </div>
        <div className={`modal-body ${bodyClassName}`}>{children}</div>
        <div className="modal-footer" style={{ background: '#f8f9fa' }}>{footer}</div>
      </div>
    </div>
  </div>;
}
