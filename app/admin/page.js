'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import ActivityLogPanel from '@/components/ActivityLogPanel';
import NhsoApiSettingsCard from '@/components/NhsoApiSettingsCard';

const ADMIN_ERROR_LABELS = {
  PASSWORD_TOO_SHORT: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร',
  VILLAGE_REQUIRED: 'กรุณาระบุหมู่รับผิดชอบของ อสม. เป็นตัวเลขเท่านั้น (เช่น 1 หรือ 1,2)',
  USERNAME_EXISTS: 'Username นี้มีผู้ใช้งานในระบบแล้ว กรุณาใช้ชื่ออื่น',
  INVALID_USER: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง (Username ต้องเป็นภาษาอังกฤษ/ตัวเลข 3 ตัวขึ้นไป ห้ามเว้นวรรค และต้องกรอกรหัสผ่าน)',
  ADMIN_REQUIRED: 'ต้องเข้าสู่ระบบด้วยบัญชี Admin เท่านั้น',
  LAST_ADMIN: 'ไม่สามารถปิดใช้งานหรือเปลี่ยนสิทธิ์ Admin คนสุดท้ายของระบบได้',
  USER_NOT_FOUND: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ',
};

export default function AdminPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ displayName:'', username:'', password:'', role:'vhv', moo:'', isActive:true });
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') { alert('หน้านี้สำหรับ Admin เท่านั้น'); router.push('/'); }
  }, [user, loading, router]);

  useEffect(() => { if (user?.role === 'admin') loadUsers(); }, [user]);

  const loadUsers = async () => {
    const { data } = await supabase.from('app_users').select('id,username,display_name,role,moo,is_active,last_login,created_at').limit(500);
    setUsers(data || []);
  };

  const filteredUsers = users.filter(u => !searchQ || (u.display_name||'').toLowerCase().includes(searchQ.toLowerCase()) || (u.username||'').toLowerCase().includes(searchQ.toLowerCase()));

  const roleCounts = users.reduce((c, u) => { c[u.role] = (c[u.role]||0) + 1; return c; }, {});

  const openCreate = () => {
    setEditUser(null);
    setFormError('');
    setForm({ displayName:'', username:'', password:'', role:'vhv', moo:'', isActive:true });
    setShowModal(true);
  };
  const openEdit = (u) => {
    setEditUser(u);
    setFormError('');
    setForm({ displayName:u.display_name||'', username:u.username||'', password:'', role:u.role||'vhv', moo:u.moo||'', isActive:u.is_active!==false });
    setShowModal(true);
  };

  const submitUser = async () => {
    if (saving) return;
    setFormError('');
    const cleanName = form.displayName.trim();
    const cleanUser = form.username.trim();
    const cleanMoo = form.moo.trim();

    if (!cleanName) {
      setFormError('กรุณากรอกชื่อ-สกุล');
      return;
    }
    if (!editUser) {
      if (!/^[a-zA-Z0-9_.-]{3,150}$/.test(cleanUser)) {
        setFormError('Username ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _ . - ความยาวอย่างน้อย 3 ตัวอักษร (ห้ามเว้นวรรคหรือภาษาไทย)');
        return;
      }
      if (!form.password || form.password.length < 8) {
        setFormError('รหัสผ่านสำหรับผู้ใช้ใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
        return;
      }
    } else if (form.password && form.password.length < 8) {
      setFormError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (form.role === 'vhv' && !/^[0-9]+(\s*,\s*[0-9]+)*$/.test(cleanMoo)) {
      setFormError('สำหรับบทบาท อสม. กรุณาระบุหมู่รับผิดชอบเป็นตัวเลขเท่านั้น (เช่น 1 หรือ 1,2)');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('app_admin_save_user', {
        p_id: editUser?.id || null,
        p_username: cleanUser,
        p_display_name: cleanName,
        p_role: form.role,
        p_moo: cleanMoo,
        p_active: form.isActive,
        p_password: form.password || null,
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      setShowModal(false);
      if (editUser?.id === user.userId) await refreshUser();
      else await loadUsers();
    } catch (error) {
      const msg = ADMIN_ERROR_LABELS[error.message] || error.message || 'เกิดข้อผิดพลาดในการบันทึก';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const doChangePassword = async () => {
    if (saving) return;
    if (!oldPwd || newPwd.length < 8 || newPwd !== confirmPwd) { alert('ตรวจสอบรหัสผ่านเดิมและรหัสผ่านใหม่อย่างน้อย 8 ตัวให้ตรงกัน'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('app_change_password', { p_old: oldPwd, p_new: newPwd });
      if (error || data?.error) throw new Error(error?.message || data.error);
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      alert('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่');
      await refreshUser();
    } catch (error) { alert('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + error.message); }
    finally { setSaving(false); }
  };

  if (loading || !user || user.role !== 'admin') return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;

  return (
    <>
      <div className="top-bar">
        <div><i className="fa-solid fa-users-gear me-2"/><strong>จัดการผู้ใช้งาน</strong> <span className="text-white-50 ms-2" style={{fontSize:'.82rem'}}>รพ.สต.บ้านโนนสว่าง</span></div>
        <div className="d-flex align-items-center gap-3">
          <span className="text-white-50 small">{user.displayName}</span>
          <a href="/" className="btn btn-sm btn-outline-light rounded-pill"><i className="fa-solid fa-arrow-left me-1"/>กลับ</a>
        </div>
      </div>

      <div className="container-fluid py-3" style={{maxWidth:1200}}>
        {/* Stats */}
        <div className="row g-3 mb-4 fade-in">
          {[{label:'Admin',val:roleCounts.admin||0,color:'text-danger',icon:'crown'},
            {label:'เจ้าหน้าที่',val:roleCounts.staff||0,color:'text-primary',icon:'stethoscope'},
            {label:'อสม.',val:roleCounts.vhv||0,color:'text-success',icon:'user-nurse'},
            {label:'ผู้บริหาร',val:roleCounts.manager||0,color:'text-warning',icon:'user-tie'}
          ].map(({label,val,color,icon}) => (
            <div className="col-6 col-md-3" key={label}>
              <div className="bg-white rounded-3 p-3 text-center shadow-sm"><div className={`h3 fw-bold ${color} mb-0`}>{val}</div><div className="small text-muted mt-1"><i className={`fa-solid fa-${icon} me-1`}/>{label}</div></div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          {[{k:'users',label:'ผู้ใช้งาน',icon:'users'},{k:'nhso',label:'เชื่อมต่อ NHSO API',icon:'cloud'},{k:'logs',label:'บันทึก',icon:'clipboard-list'},{k:'password',label:'เปลี่ยนรหัส',icon:'key'}].map(({k,label,icon}) => (
            <li className="nav-item" key={k}><a className={`nav-link ${tab===k?'active':''}`} href="#" onClick={e=>{e.preventDefault();setTab(k);}} style={{fontWeight:600}}><i className={`fa-solid fa-${icon} me-1`}/>{label}</a></li>
          ))}
        </ul>

        {/* NHSO API Tab */}
        {tab === 'nhso' && (
          <div className="fade-in">
            <NhsoApiSettingsCard />
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="fade-in">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <input type="text" className="form-control" style={{maxWidth:260,borderRadius:10}} placeholder="🔍 ค้นหาชื่อ / username" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              <button className="btn btn-primary rounded-pill" onClick={openCreate}><i className="fa-solid fa-plus me-1"/>เพิ่มผู้ใช้</button>
            </div>
            <div className="card shadow-sm border-0" style={{borderRadius:14,overflow:'hidden'}}>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light"><tr><th>ชื่อ-สกุล</th><th>Username</th><th>บทบาท</th><th>หมู่</th><th>สถานะ</th><th>Login ล่าสุด</th><th></th></tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td className="fw-bold">{u.display_name||'-'}</td>
                        <td><code className="text-primary">{u.username}</code></td>
                        <td><span className={`role-pill role-${u.role}`}>{ROLE_LABELS[u.role]||u.role}</span></td>
                        <td>{u.moo ? <span className="badge bg-light text-dark border">{u.moo}</span> : <span className="text-muted small">{u.role==='vhv'?'ยังไม่ได้กำหนดหมู่':'ทุกหมู่'}</span>}</td>
                        <td><span className={`badge ${u.is_active?'bg-success':'bg-secondary'}`}>{u.is_active?'ใช้งาน':'ปิด'}</span></td>
                        <td><small className="text-muted">{u.last_login ? new Date(u.last_login).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'ยังไม่เคย'}</small></td>
                        <td><button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => openEdit(u)}><i className="fa-solid fa-pen"/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {tab === 'logs' && <ActivityLogPanel />}

        {/* Password Tab */}
        {tab === 'password' && (
          <div className="card shadow-sm border-0 mx-auto" style={{maxWidth:400,borderRadius:14}}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-4"><i className="fa-solid fa-key text-warning me-2"/>เปลี่ยนรหัสผ่าน</h6>
              <div className="mb-3"><label className="small text-muted fw-bold">รหัสผ่านเดิม</label><input type="password" className="form-control" value={oldPwd} onChange={e=>setOldPwd(e.target.value)}/></div>
              <div className="mb-3"><label className="small text-muted fw-bold">รหัสผ่านใหม่ (≥ 8 ตัว)</label><input type="password" className="form-control" value={newPwd} onChange={e=>setNewPwd(e.target.value)}/></div>
              <div className="mb-4"><label className="small text-muted fw-bold">ยืนยันรหัสผ่านใหม่</label><input type="password" className="form-control" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}/></div>
              <button className="btn btn-warning w-100 fw-bold rounded-pill" disabled={saving} onClick={doChangePassword}><i className="fa-solid fa-save me-2"/>บันทึก</button>
            </div>
          </div>
        )}
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{background:'rgba(0,0,0,.5)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{borderRadius:16,overflow:'hidden'}}>
              <div className="modal-header text-white" style={{background:'var(--primary)'}}>
                <h5 className="modal-title fw-bold">
                  <i className={`fa-solid fa-${editUser?'user-pen':'user-plus'} me-2`}/>
                  {editUser?'แก้ไขผู้ใช้':'เพิ่มผู้ใช้ใหม่'}
                </h5>
                <button className="btn-close btn-close-white" onClick={()=>setShowModal(false)}/>
              </div>
              <div className="modal-body p-4">
                {formError && (
                  <div role="alert" className="alert alert-danger py-2 px-3 small fw-semibold mb-3">
                    ⚠️ {formError}
                  </div>
                )}
                <div className="mb-3">
                  <label className="small fw-bold">ชื่อ-สกุล *</label>
                  <input type="text" className="form-control" placeholder="เช่น นางสมศรี ใจดี" value={form.displayName} onChange={e=>{setFormError(''); setForm({...form,displayName:e.target.value});}}/>
                </div>
                <div className="mb-3">
                  <label className="small fw-bold">Username * <span className="text-muted fw-normal">(ภาษาอังกฤษ/ตัวเลข ≥ 3 ตัว ห้ามเว้นวรรค)</span></label>
                  <input type="text" className="form-control" placeholder="เช่น vhv01 หรือ somchai" value={form.username} onChange={e=>{setFormError(''); setForm({...form,username:e.target.value});}} disabled={!!editUser} autoCapitalize="none"/>
                </div>
                <div className="mb-3">
                  <label className="small fw-bold">รหัสผ่าน {editUser ? '(เว้นว่างถ้าไม่เปลี่ยน, ≥ 8 ตัว)' : '* (ต้องอย่างน้อย 8 ตัวอักษร)'}</label>
                  <input type="password" className="form-control" placeholder="อย่างน้อย 8 ตัวอักษร" value={form.password} onChange={e=>{setFormError(''); setForm({...form,password:e.target.value});}}/>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="small fw-bold">บทบาท</label>
                    <select className="form-select" value={form.role} onChange={e=>{setFormError(''); setForm({...form,role:e.target.value});}}>
                      <option value="vhv">อสม.</option>
                      <option value="staff">เจ้าหน้าที่</option>
                      <option value="manager">ผู้บริหาร</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {form.role === 'vhv' && (
                    <div className="col-6">
                      <label className="small fw-bold">หมู่รับผิดชอบ * <span className="text-muted fw-normal">(ตัวเลขเท่านั้น)</span></label>
                      <input type="text" className="form-control" value={form.moo} onChange={e=>{setFormError(''); setForm({...form,moo:e.target.value});}} placeholder="เช่น 1 หรือ 1,2"/>
                    </div>
                  )}
                </div>
                {editUser && (
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>
                    <label className="form-check-label small">เปิดใช้งาน</label>
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button className="btn btn-outline-secondary rounded-pill" onClick={()=>setShowModal(false)}>ยกเลิก</button>
                <button className="btn btn-primary fw-bold rounded-pill px-4" disabled={saving} onClick={submitUser}>
                  <i className="fa-solid fa-save me-1"/>{saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
