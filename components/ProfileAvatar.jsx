'use client';
import { useState } from 'react';

export default function ProfileAvatar({ src, name = '', size = 32, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const url = typeof src === 'string' ? src.trim() : '';
  const initials = Array.from(name.trim() || 'ผู้ใช้').slice(0, 1).join('');
  const style = { width: size, height: size, flexShrink: 0, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.7)' };
  if (url && failedSrc !== url) {
    return <img key={url} src={url} alt={`รูปโปรไฟล์ ${name || 'ผู้ใช้'}`} width={size} height={size} className={className} style={style} referrerPolicy="no-referrer" onError={() => setFailedSrc(url)} />;
  }
  return <span role="img" aria-label={`รูปสำรอง ${name || 'ผู้ใช้'}`} className={className} style={{ ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e4ecff', color: '#253e92', fontSize: Math.round(size * .45), fontWeight: 700 }}>{initials}</span>;
}
