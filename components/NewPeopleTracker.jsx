'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculateAge } from '@/lib/utils';

const CATEGORIES = [
  {
    key: 'new_houses',
    label: '🏡 บ้านที่ถูกเพิ่มใหม่ (นอก HOSxP)',
    sub: 'บ้านเลขที่ใหม่ที่ยังไม่มีในทะเบียนบ้าน HOSxP',
    badgeClass: 'bg-primary-subtle text-primary border-primary-subtle',
    unit: 'หลัง',
  },
  {
    key: 'ready_for_hosxp',
    label: '🟠 คนใหม่พร้อมคีย์เข้า HOSxP',
    sub: 'มีเลขบัตร 13 หลักถูกต้อง แต่ยังไม่มีใน HOSxP',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border-warning-subtle',
    unit: 'คน',
  },
  {
    key: 'missing_cid',
    label: '🔴 รอตามเก็บเลขบัตร 13 หลัก',
    sub: 'ยังไม่ได้ระบุเลขบัตร หรือเลขบัตรไม่ครบ 13 หลัก',
    badgeClass: 'bg-danger-subtle text-danger border-danger-subtle',
    unit: 'คน',
  },
  {
    key: 'duplicate',
    label: '🟣 เลขบัตรซ้ำในระบบ',
    sub: 'ซ้ำกับรายชื่ออื่น ต้องตรวจสอบ',
    badgeClass: 'bg-info-subtle text-info-emphasis border-info-subtle',
    unit: 'คน',
  },
  {
    key: 'matched_in_hosxp',
    label: '🟢 พบในฐาน HOSxP แล้ว',
    sub: 'จับคู่รหัสบุคคลใน HOSxP ได้แล้ว',
    badgeClass: 'bg-success-subtle text-success border-success-subtle',
    unit: 'คน',
  },
];

const PAGE_SIZE = 20;

function formatThaiBirthDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(String(isoDate))) return 'ยังไม่ระบุวันเกิด';
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 'ยังไม่ระบุวันเกิด';
  const months = [
    '',
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ];
  return `${d} ${months[m] || m} ${y + 543}`;
}

export default function NewPeopleTracker({ user, onOpenHouse, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('new_houses');
  const [moo, setMoo] = useState('');
  const [vhv, setVhv] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState('');

  // Inline editing state for CID & Birth Date
  const [editingId, setEditingId] = useState(null);
  const [editCid, setEditCid] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/new-people', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'โหลดข้อมูลผู้ที่ถูกเพิ่มใหม่ไม่สำเร็จ');
      }
      setData(json);
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const counts = data?.counts || {
    total: 0,
    new_houses: 0,
    ready_for_hosxp: 0,
    missing_cid: 0,
    duplicate: 0,
    matched_in_hosxp: 0,
  };

  const filteredHouses = useMemo(() => {
    const list = data?.newHouses || [];
    const q = search.trim().toLowerCase();
    return list.filter((h) => {
      if (moo && h.moo !== moo) return false;
      if (vhv && h.vhv !== vhv) return false;
      if (!q) return true;
      return (
        String(h.house || '').toLowerCase().includes(q) ||
        String(h.vhv || '').toLowerCase().includes(q) ||
        h.members.some(
          (m) => m.fullname.toLowerCase().includes(q) || String(m.cid || '').includes(q)
        )
      );
    });
  }, [data, moo, vhv, search]);

  const filteredRows = useMemo(() => {
    const list = data?.rows || [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (category !== 'all' && category !== 'new_houses' && r.category !== category) return false;
      if (moo && r.moo !== moo) return false;
      if (vhv && r.vhv !== vhv) return false;
      if (!q) return true;
      return (
        r.fullname.toLowerCase().includes(q) ||
        String(r.cid || '').includes(q) ||
        String(r.house || '').toLowerCase().includes(q) ||
        String(r.person_id || '').toLowerCase().includes(q)
      );
    });
  }, [data, category, moo, vhv, search]);

  const activeItemsLength =
    category === 'new_houses' ? filteredHouses.length : filteredRows.length;
  const pages = Math.max(1, Math.ceil(activeItemsLength / PAGE_SIZE));
  const currentPage = Math.min(page, pages);

  const startEdit = (row) => {
    setEditingId(row.person_id);
    setEditCid(row.cid || '');
    setEditBirth(row.birth_date ? String(row.birth_date).slice(0, 10) : '');
    setEditError('');
  };

  const saveIdentity = async (row) => {
    if (savingEdit) return;
    setSavingEdit(true);
    setEditError('');
    setNotice('');
    try {
      const res = await fetch('/api/new-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_identity',
          personId: row.person_id,
          cid: editCid,
          birthDate: editBirth || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      }
      setEditingId(null);
      setNotice(`✅ บันทึกเลขบัตร 13 หลักของ ${row.fullname} เรียบร้อยแล้ว`);
      await load();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const copyCid = async (personId, cid) => {
    if (!cid) return;
    try {
      await navigator.clipboard.writeText(cid);
      setCopiedId(personId);
      setTimeout(() => setCopiedId(''), 2000);
    } catch {
      // Fallback
    }
  };

  const exportCsv = () => {
    const escapeCsv = (val) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    if (category === 'new_houses') {
      if (!filteredHouses.length) return;
      const headers = [
        'หมู่ที่',
        'บ้านเลขที่ใหม่ (ยังไม่มีใน HOSxP)',
        'อสม.ผู้รับผิดชอบ',
        'จำนวนสมาชิกที่เพิ่ม',
        'มีเลขบัตรครบ 13 หลัก (คน)',
        'ยังขาดเลขบัตร (คน)',
        'รายชื่อสมาชิกในบ้าน',
        'พิกัด GPS (ละติจูด, ลองจิจูด)',
      ];
      const lines = [
        headers.map(escapeCsv).join(','),
        ...filteredHouses.map((h) =>
          [
            h.moo,
            h.house,
            h.vhv,
            h.members.length,
            h.ready_members,
            h.missing_cid_members,
            h.members.map((m) => `${m.fullname} (${m.cid || 'ยังไม่ระบุเลขบัตร'})`).join(' | '),
            h.has_gps ? `${h.latitude}, ${h.longitude}` : 'ยังไม่มีพิกัด',
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ];
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `new-houses-hosxp-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!filteredRows.length) return;
    const headers = [
      'รหัสสำรวจ',
      'หมู่ที่',
      'บ้านเลขที่',
      'มีเลขบ้านใน HOSxP หรือยัง',
      'คำนำหน้า',
      'ชื่อ',
      'นามสกุล',
      'เลขบัตรประชาชน 13 หลัก',
      'วันเกิด (ค.ศ.)',
      'วันเกิด (พ.ศ.)',
      'อายุ (ปี)',
      'สถานะในบ้าน',
      'ประเภทอยู่อาศัย (Type)',
      'โรคประจำตัว',
      'อสม.ผู้รับผิดชอบ',
      'สถานะเทียบ HOSxP',
      'รหัส person_id ใน HOSxP',
    ];
    const catLabel = {
      ready_for_hosxp: 'พร้อมคีย์เพิ่มเข้า HOSxP',
      missing_cid: 'รอตามเก็บเลขบัตร 13 หลัก',
      duplicate: 'เลขบัตรซ้ำในระบบ',
      matched_in_hosxp: 'พบในฐาน HOSxP แล้ว',
    };
    const lines = [
      headers.map(escapeCsv).join(','),
      ...filteredRows.map((r) =>
        [
          r.person_id,
          r.moo,
          r.house,
          r.house_in_hosxp ? 'มีบ้านใน HOSxP แล้ว' : 'บ้านใหม่ (ต้องเปิดบ้านใน HOSxP ก่อน)',
          r.title,
          r.fname,
          r.lname,
          r.cid ? `="${r.cid}"` : '',
          r.birth_date || '',
          formatThaiBirthDate(r.birth_date),
          calculateAge(r.birth_date),
          r.relation,
          `Type ${r.residency_type || '3'}`,
          r.chronic,
          r.vhv,
          catLabel[r.category] || r.category,
          r.hosxp_person_id || '',
        ]
          .map(escapeCsv)
          .join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `new-people-hosxp-${category}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSheet = () => {
    if (!activeItemsLength) return;
    const w = window.open('', '_blank');
    if (!w) {
      window.alert('กรุณาอนุญาตให้เปิดหน้าต่างใหม่เพื่อพิมพ์ใบงาน');
      return;
    }
    w.opener = null;
    const d = w.document;
    d.documentElement.lang = 'th';
    const titleText =
      category === 'new_houses'
        ? 'ใบงานเจ้าหน้าที่: รายการบ้านที่ถูกเพิ่มใหม่จากการสำรวจ (ต้องเปิดทะเบียนบ้านใหม่ใน HOSxP)'
        : category === 'ready_for_hosxp'
        ? 'ใบงานเจ้าหน้าที่: รายชื่อผู้เพิ่มใหม่ที่พร้อมคีย์ขึ้นทะเบียนเข้า HOSxP'
        : category === 'missing_cid'
        ? 'ใบงาน อสม.: รายชื่อผู้เพิ่มใหม่ที่ต้องตามเก็บเลขบัตรประชาชน 13 หลักและวันเกิด'
        : 'รายงานติดตามบ้านและผู้ที่ถูกเพิ่มใหม่จากการสำรวจ (P-...)';
    d.title = titleText;
    const add = (parent, tag, value) => {
      const el = d.createElement(tag);
      el.textContent = value;
      parent.appendChild(el);
      return el;
    };
    add(
      d.head,
      'style',
      '@page{size:A4 landscape;margin:10mm}body{font:13px sans-serif;color:#111}table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #666;padding:6px;text-align:left}tr{break-inside:avoid}thead{display:table-header-group}@media print{button{display:none}}'
    );
    add(d.body, 'h2', titleText);
    add(
      d.body,
      'p',
      `${moo ? 'หมู่ที่ ' + moo : 'ทุกหมู่บ้าน'} • ${vhv ? 'อสม. ' + vhv : 'อสม. ทุกคน'} • รวม ${
        activeItemsLength
      } ${category === 'new_houses' ? 'หลัง' : 'คน'} • พิมพ์เมื่อ ${new Date().toLocaleDateString('th-TH')}`
    );
    const table = add(d.body, 'table', '');
    const thead = table.createTHead().insertRow();
    const tbody = table.createTBody();

    if (category === 'new_houses') {
      for (const h of [
        'ลำดับ',
        'หมู่',
        'บ้านเลขที่ใหม่',
        'อสม.ผู้รับผิดชอบ',
        'จำนวนสมาชิก',
        'รายชื่อสมาชิกในบ้าน (เลขบัตร 13 หลัก)',
        'พิกัด GPS',
        'ผลการเปิดบ้านใน HOSxP',
      ]) {
        add(thead, 'th', h);
      }
      filteredHouses.forEach((h, idx) => {
        const tr = tbody.insertRow();
        for (const val of [
          String(idx + 1),
          h.moo,
          h.house,
          h.vhv,
          `${h.members.length} คน`,
          h.members
            .map((m) => `${m.fullname} (${m.cid || 'ยังไม่ระบุเลขบัตร'})`)
            .join(', '),
          h.has_gps ? `${h.latitude.toFixed(6)}, ${h.longitude.toFixed(6)}` : 'ยังไม่มีพิกัด',
          '',
        ]) {
          tr.insertCell().textContent = val;
        }
      });
    } else {
      for (const h of [
        'ลำดับ',
        'หมู่',
        'บ้านเลขที่',
        'สถานะบ้านใน HOSxP',
        'ชื่อ-นามสกุล',
        'เลขบัตรประชาชน 13 หลัก',
        'วันเกิด / อายุ',
        'สถานะในบ้าน / Type',
        'อสม.ผู้รับผิดชอบ',
        'บันทึกการตรวจสอบ',
      ]) {
        add(thead, 'th', h);
      }
      filteredRows.forEach((r, idx) => {
        const tr = tbody.insertRow();
        for (const val of [
          String(idx + 1),
          r.moo,
          r.house,
          r.house_in_hosxp ? 'มีบ้านแล้ว' : 'บ้านเพิ่มใหม่',
          r.fullname,
          r.cid || '________________________',
          `${formatThaiBirthDate(r.birth_date)} (อายุ ${calculateAge(r.birth_date)})`,
          `${r.relation} (Type ${r.residency_type || '3'})`,
          r.vhv,
          r.hosxp_person_id ? `มีใน HOSxP แล้ว (#${r.hosxp_person_id})` : '',
        ]) {
          tr.insertCell().textContent = val;
        }
      });
    }
    const btn = add(d.body, 'button', '🖨️ สั่งพิมพ์');
    btn.onclick = () => w.print();
    w.focus();
    w.print();
  };

  return (
    <section
      className="card border-0 shadow-sm mb-4"
      style={{ borderRadius: 16 }}
      aria-labelledby="new-people-tracker-title"
    >
      <div className="card-body p-3 p-md-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
          <div>
            <h2 id="new-people-tracker-title" className="h5 fw-bold mb-1">
              🆕 ติดตามบ้านเพิ่มใหม่ และผู้ที่ถูกเพิ่มใหม่นอกฐาน HOSxP (บ้านใหม่ {counts.new_houses} หลัง • คนใหม่ {counts.total.toLocaleString('th-TH')} คน)
            </h2>
            <p className="text-muted small mb-0">
              ตรวจสอบบ้านเลขที่ที่ อสม. เพิ่มใหม่แต่ยังไม่มีในทะเบียนบ้าน HOSxP และรายชื่อคนที่เพิ่มใหม่ (`P-...`) เพื่อนำไปขึ้นทะเบียนเข้า HOSxP
              {data?.snapshot?.captured_at && (
                <span>
                  {' '}
                  • ข้อมูลอ้างอิง HOSxP ล่าสุด{' '}
                  {new Date(data.snapshot.captured_at).toLocaleString('th-TH')}
                </span>
              )}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold"
              disabled={busy || !activeItemsLength}
              onClick={exportCsv}
            >
              📥 ส่งออก Excel / CSV ({activeItemsLength})
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold"
              disabled={busy || !activeItemsLength}
              onClick={printSheet}
            >
              🖨️ พิมพ์ใบงาน ({activeItemsLength})
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary rounded-pill px-3"
              disabled={busy}
              onClick={load}
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>

        {notice && (
          <div role="status" className="alert alert-success py-2 px-3 small my-2">
            {notice}
          </div>
        )}

        {/* การ์ดสรุป 5 กลุ่ม (รวม "บ้านที่ถูกเพิ่มใหม่") คลิกเพื่อกรองได้ทันที */}
        <div className="row g-2 my-2">
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            const val = counts[cat.key] || 0;
            return (
              <div key={cat.key} className="col-6 col-lg">
                <button
                  type="button"
                  onClick={() => {
                    setCategory(cat.key);
                    setPage(1);
                  }}
                  className={`btn w-100 text-start p-2 px-3 rounded-3 border h-100 ${
                    active ? 'border-primary border-2 shadow-sm bg-primary-subtle' : 'bg-white'
                  }`}
                >
                  <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>
                    {cat.label}
                  </div>
                  <div className="fs-4 fw-bold text-dark my-1">
                    {val.toLocaleString('th-TH')}{' '}
                    <span className="fs-6 fw-normal text-muted">{cat.unit}</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '.72rem' }}>
                    {cat.sub}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* ตัวกรอง หมู่บ้าน / อสม. / ค้นหา */}
        <div className="row g-2 align-items-end bg-light p-2 rounded-3 border mx-0 mb-3">
          {user?.role !== 'vhv' && (
            <>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold mb-1" htmlFor="new-people-moo">
                  หมู่บ้าน
                </label>
                <select
                  id="new-people-moo"
                  className="form-select form-select-sm"
                  value={moo}
                  onChange={(e) => {
                    setMoo(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกหมู่บ้าน</option>
                  {(data?.villages || []).map((m) => (
                    <option key={m} value={m}>
                      หมู่ที่ {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold mb-1" htmlFor="new-people-vhv">
                  อสม.ผู้รับผิดชอบ
                </label>
                <select
                  id="new-people-vhv"
                  className="form-select form-select-sm"
                  value={vhv}
                  onChange={(e) => {
                    setVhv(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">อสม. ทุกคน</option>
                  {(data?.owners || []).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className={user?.role === 'vhv' ? 'col-12 col-md-9' : 'col-12 col-md-4'}>
            <label className="form-label small fw-semibold mb-1" htmlFor="new-people-search">
              ค้นหาบ้านเลขที่ / ชื่อ / เลขบัตร
            </label>
            <input
              id="new-people-search"
              type="search"
              className="form-control form-control-sm"
              placeholder="พิมพ์เลขที่บ้าน, ชื่อ หรือเลขบัตร..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="col-12 col-md-2 d-flex gap-1">
            <button
              type="button"
              className={`btn btn-sm flex-grow-1 ${
                category === 'all' ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => {
                setCategory('all');
                setPage(1);
              }}
            >
              ดูคนทั้งหมด ({counts.total})
            </button>
          </div>
        </div>

        {busy ? (
          <p role="status" className="text-center py-4">
            <span className="spinner-border spinner-border-sm text-primary me-2" />
            กำลังโหลดและเทียบบ้าน/รายชื่อที่เพิ่มใหม่กับฐาน HOSxP…
          </p>
        ) : error ? (
          <div role="alert" className="alert alert-danger">
            {error}
          </div>
        ) : category === 'new_houses' ? (
          /* ตารางแสดง "บ้านที่ถูกเพิ่มใหม่ (ยังไม่มีเลขบ้านใน HOSxP)" */
          !filteredHouses.length ? (
            <div className="text-center py-4 bg-light rounded-3 border text-muted">
              ไม่พบบ้านเลขที่ที่เพิ่มใหม่นอกเหนือจากฐาน HOSxP
            </div>
          ) : (
            <>
              <div className="alert alert-info py-2 px-3 small mb-3">
                💡 <strong>คำแนะนำสำหรับเจ้าหน้าที่:</strong> บ้านเหล่านี้คือบ้านเลขที่ที่ อสม. กด &ldquo;เพิ่มบ้านใหม่&rdquo; บนเว็บสำรวจ แต่ยังไม่มีบ้านเลขที่นี้ในตาราง <code>house</code> ของ HOSxP — เจ้าหน้าที่ควรเปิดบ้านเลขที่เหล่านี้ในบัญชี 1 ของ HOSxP ก่อน แล้วกดดึงทะเบียนบ้านใหม่ จึงจะส่งพิกัด GPS และย้ายคนเข้าบ้านใน HOSxP ได้
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>บ้านเลขที่ใหม่ / หมู่</th>
                      <th>อสม.ผู้รับผิดชอบ</th>
                      <th>สมาชิกที่เพิ่มในบ้านนี้</th>
                      <th>พิกัด GPS บนเว็บ</th>
                      <th className="text-end">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHouses
                      .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                      .map((h) => (
                        <tr key={h.key}>
                          <td>
                            <div className="fw-bold text-primary" style={{ fontSize: '1.05rem' }}>
                              🏡 บ้านเลขที่ {h.house}
                            </div>
                            <span className="badge bg-secondary">หมู่ที่ {h.moo}</span>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle ms-1">
                              ยังไม่มีเลขบ้านใน HOSxP
                            </span>
                          </td>
                          <td>
                            <div className="fw-semibold">{h.vhv}</div>
                          </td>
                          <td>
                            <div className="small fw-bold mb-1">
                              รวม {h.members.length} คน (มีเลขบัตร {h.ready_members} • ขาดเลขบัตร{' '}
                              <span className={h.missing_cid_members > 0 ? 'text-danger' : ''}>
                                {h.missing_cid_members}
                              </span>
                              )
                            </div>
                            <ul className="list-unstyled small mb-0">
                              {h.members.map((m) => (
                                <li key={m.person_id} className="text-muted">
                                  • <strong className="text-dark">{m.fullname}</strong> ({m.relation}) —{' '}
                                  {m.valid_cid ? (
                                    <code className="text-success fw-bold">{m.cid}</code>
                                  ) : (
                                    <span className="text-danger">ยังไม่ระบุเลขบัตร 13 หลัก</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            {h.has_gps ? (
                              <div>
                                <span className="badge bg-success-subtle text-success border border-success-subtle">
                                  📍 มีพิกัดบนเว็บแล้ว
                                </span>
                                <div className="small text-muted mt-1" style={{ fontSize: '.74rem' }}>
                                  {h.latitude.toFixed(6)}, {h.longitude.toFixed(6)}
                                </div>
                              </div>
                            ) : (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                ⚠️ ยังไม่มีพิกัด
                              </span>
                            )}
                          </td>
                          <td className="text-end">
                            {onOpenHouse && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary fw-semibold"
                                onClick={() => onOpenHouse(h.moo, h.house)}
                              >
                                🏠 เปิดดูบ้านนี้
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : !filteredRows.length ? (
          <div className="text-center py-4 bg-light rounded-3 border text-muted">
            ไม่พบรายชื่อผู้ที่ถูกเพิ่มใหม่ในหมวดหมู่นี้
          </div>
        ) : (
          /* ตารางแสดงรายคน (P-...) */
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>ชื่อ-นามสกุล / วันเกิด</th>
                  <th>เลขบัตรประชาชน 13 หลัก</th>
                  <th>บ้าน / หมู่ / อสม.</th>
                  <th>สถานะในบ้าน / โรค</th>
                  <th>สถานะเทียบ HOSxP</th>
                  <th className="text-end">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows
                  .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  .map((row) => {
                    const isEditing = editingId === row.person_id;
                    const catInfo = CATEGORIES.find((c) => c.key === row.category);
                    return (
                      <tr key={row.person_id}>
                        <td>
                          <div className="fw-bold text-dark">{row.fullname}</div>
                          <div className="small text-muted">
                            เกิด: {formatThaiBirthDate(row.birth_date)} (อายุ{' '}
                            {calculateAge(row.birth_date)})
                          </div>
                          <div className="text-muted" style={{ fontSize: '.72rem' }}>
                            รหัสสำรวจ: {row.person_id}
                          </div>
                        </td>

                        <td>
                          {isEditing ? (
                            <div className="p-2 border rounded-3 bg-light" style={{ minWidth: 230 }}>
                              <label className="small fw-bold d-block mb-1">
                                เลขบัตร 13 หลัก *
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={13}
                                className="form-control form-control-sm mb-2 fw-bold"
                                placeholder="กรอกเลขบัตร 13 หลัก"
                                value={editCid}
                                onChange={(e) =>
                                  setEditCid(
                                    e.target.value
                                      .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
                                      .replace(/\D/g, '')
                                  )
                                }
                              />
                              <label className="small fw-bold d-block mb-1">
                                วันเกิด (ค.ศ. หรือเลือกจากปฏิทิน)
                              </label>
                              <input
                                type="date"
                                className="form-control form-control-sm mb-2"
                                value={editBirth}
                                onChange={(e) => setEditBirth(e.target.value)}
                              />
                              {editError && (
                                <div className="text-danger small fw-semibold mb-2">
                                  ⚠️ {editError}
                                </div>
                              )}
                              <div className="d-flex gap-1">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary fw-bold flex-grow-1"
                                  disabled={savingEdit}
                                  onClick={() => saveIdentity(row)}
                                >
                                  {savingEdit ? 'บันทึก…' : '💾 บันทึก'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  disabled={savingEdit}
                                  onClick={() => setEditingId(null)}
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : row.valid_cid ? (
                            <div className="d-flex align-items-center gap-1 flex-wrap">
                              <code className="fs-6 fw-bold text-dark">{row.cid}</code>
                              <button
                                type="button"
                                className="btn btn-sm btn-light border py-0 px-2"
                                title="คัดลอกเลขบัตรไปวางใน HOSxP"
                                onClick={() => copyCid(row.person_id, row.cid)}
                              >
                                {copiedId === row.person_id ? '✅ คัดลอกแล้ว' : '📋 คัดลอก'}
                              </button>
                            </div>
                          ) : (
                            <div>
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                ⚠️ {row.cid ? `ไม่ครบ/ไม่ถูก (${row.cid})` : 'ยังไม่กรอกเลขบัตร'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="fw-bold">
                            บ้านเลขที่ {row.house || '-'}{' '}
                            <span className="badge bg-secondary">ม.{row.moo}</span>
                          </div>
                          {!row.house_in_hosxp && (
                            <span
                              className="badge bg-primary-subtle text-primary border border-primary-subtle mt-1"
                              style={{ fontSize: '.72rem' }}
                            >
                              🏡 บ้านเพิ่มใหม่ (ยังไม่มีใน HOSxP)
                            </span>
                          )}
                          <div className="small text-muted mt-1">อสม. {row.vhv}</div>
                        </td>

                        <td>
                          <div className="small">
                            <strong>{row.relation}</strong> • Type {row.residency_type || '3'}
                          </div>
                          <div className="small text-muted">{row.chronic}</div>
                        </td>

                        <td>
                          <span className={`badge border ${catInfo?.badgeClass || 'bg-light text-dark'}`}>
                            {catInfo?.label || row.category}
                          </span>
                          {row.hosxp_person_id && (
                            <div className="small text-success fw-semibold mt-1">
                              HOSxP person_id: #{row.hosxp_person_id}
                            </div>
                          )}
                        </td>

                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1 flex-wrap">
                            {!isEditing && (
                              <button
                                type="button"
                                className={`btn btn-sm ${
                                  !row.valid_cid ? 'btn-warning fw-bold' : 'btn-outline-secondary'
                                }`}
                                onClick={() => startEdit(row)}
                              >
                                ✏️ {!row.valid_cid ? 'กรอกเลขบัตร' : 'แก้เลขบัตร/วันเกิด'}
                              </button>
                            )}
                            {onOpenHouse && row.house && row.moo && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => onOpenHouse(row.moo, row.house)}
                              >
                                🏠 เปิดบ้าน
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              ⬅️ ก่อนหน้า
            </button>
            <span className="small text-muted">
              หน้า {currentPage} / {pages} (ทั้งหมด {activeItemsLength}{' '}
              {category === 'new_houses' ? 'หลัง' : 'คน'})
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              ถัดไป ➡️
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
