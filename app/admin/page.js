'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import TopBar from '@/components/TopBar';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
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

  const loadLogs = async () => {
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300);
    setLogs(data || []);
  };

  const filteredUsers = users.filter(u => !searchQ || (u.display_name||'').toLowerCase().includes(searchQ.toLowerCase()) || (u.username||'').toLowerCase().includes(searchQ.toLowerCase()));

  const roleCounts = users.reduce((c, u) => { c[u.role] = (c[u.role]||0) + 1; return c; }, {});

  const openCreate = () => { setEditUser(null); setForm({ displayName:'', username:'', password:'', role:'vhv', moo:'', isActive:true }); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ displayName:u.display_name||'', username:u.username||'', password:'', role:u.role||'vhv', moo:u.moo||'', isActive:u.is_active!==false }); setShowModal(true); };

  const submitUser = async () => {
    if (!form.displayName) { alert('กรุณากรอกชื่อ'); return; }
    if (!editUser && (!form.username || !form.password)) { alert('กรุณากรอก Username และรหัสผ่าน'); return; }
    if (form.password && form.password.length < 6) { alert('รหัสผ่านต้อง ≥ 6 ตัว'); return; }

    const encoder = new TextEncoder();
    let hashHex = null;
    if (form.password) {
      const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(form.password));
      hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

    if (editUser) {
      const updateData = { display_name: form.displayName, role: form.role, moo: form.moo || null, is_active: form.isActive };
      if (hashHex) updateData.password_hash = hashHex;
      await supabase.from('app_users').update(updateData).eq('id', editUser.id);
    } else {
      await supabase.from('app_users').insert({ username: form.username.toLowerCase(), password_hash: hashHex, display_name: form.displayName, role: form.role, moo: form.moo || null, is_active: true, created_at: new Date().toISOString() });
    }
    setShowModal(false); loadUsers();
  };

  const doChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) { alert('กรุณากรอกข้อมูลให้ครบ'); return; }
    if (newPwd !== confirmPwd) { alert('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (newPwd.length < 6) { alert('รหัสผ่านต้อง ≥ 6 ตัว'); return; }
    // Simplified: just update (in production, verify old password first)
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(newPwd));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
    await supabase.from('app_users').update({ password_hash: hashHex }).eq('id', user.userId);
    alert('เปลี่ยนรหัสผ่านเรียบร้อย');
  };

  if (loading || !user) return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;

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
          {[{k:'users',label:'ผู้ใช้งาน',icon:'users'},{k:'logs',label:'บันทึก',icon:'clipboard-list'},{k:'password',label:'เปลี่ยนรหัส',icon:'key'}].map(({k,label,icon}) => (
            <li className="nav-item" key={k}><a className={`nav-link ${tab===k?'active':''}`} href="#" onClick={e=>{e.preventDefault();setTab(k);if(k==='logs'&&logs.length===0)loadLogs();}} style={{fontWeight:600}}><i className={`fa-solid fa-${icon} me-1`}/>{label}</a></li>
          ))}
        </ul>

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
                        <td>{u.moo ? <span className="badge bg-light text-dark border">{u.moo}</span> : <span className="text-muted small">ทุกหมู่</span>}</td>
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
        {tab === 'logs' && (
          <div className="card shadow-sm border-0" style={{borderRadius:14,overflow:'hidden'}}>
            <div className="table-responsive" style={{maxHeight:520,overflowY:'auto'}}>
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light" style={{position:'sticky',top:0}}><tr><th style={{width:160}}>เวลา</th><th style={{width:130}}>ผู้ใช้</th><th style={{width:160}}>Action</th><th>รายละเอียด</th></tr></thead>
                <tbody>
                  {logs.map((log,i) => (
                    <tr key={i} style={{fontSize:'.82rem'}}>
                      <td className="text-muted">{log.created_at ? new Date(log.created_at).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</td>
                      <td><strong>{log.username||'-'}</strong></td>
                      <td><span className={`action-badge action-${log.action||''}`}>{log.action||'-'}</span></td>
                      <td className="text-muted">{log.detail||'-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Password Tab */}
        {tab === 'password' && (
          <div className="card shadow-sm border-0 mx-auto" style={{maxWidth:400,borderRadius:14}}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-4"><i className="fa-solid fa-key text-warning me-2"/>เปลี่ยนรหัสผ่าน</h6>
              <div className="mb-3"><label className="small text-muted fw-bold">รหัสผ่านเดิม</label><input type="password" className="form-control" value={oldPwd} onChange={e=>setOldPwd(e.target.value)}/></div>
              <div className="mb-3"><label className="small text-muted fw-bold">รหัสผ่านใหม่ (≥ 6 ตัว)</label><input type="password" className="form-control" value={newPwd} onChange={e=>setNewPwd(e.target.value)}/></div>
              <div className="mb-4"><label className="small text-muted fw-bold">ยืนยันรหัสผ่านใหม่</label><input type="password" className="form-control" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}/></div>
              <button className="btn btn-warning w-100 fw-bold rounded-pill" onClick={doChangePassword}><i className="fa-solid fa-save me-2"/>บันทึก</button>
            </div>
          </div>
        )}
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{background:'rgba(0,0,0,.5)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{borderRadius:16,overflow:'hidden'}}>
              <div className="modal-header text-white" style={{background:'var(--primary)'}}><h5 className="modal-title fw-bold"><i className={`fa-solid fa-${editUser?'user-pen':'user-plus'} me-2`}/>{editUser?'แก้ไขผู้ใช้':'เพิ่มผู้ใช้ใหม่'}</h5><button className="btn-close btn-close-white" onClick={()=>setShowModal(false)}/></div>
              <div className="modal-body p-4">
                <div className="mb-3"><label className="small fw-bold">ชื่อ-สกุล *</label><input type="text" className="form-control" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></div>
                <div className="mb-3"><label className="small fw-bold">Username *</label><input type="text" className="form-control" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} disabled={!!editUser} autoCapitalize="none"/></div>
                <div className="mb-3"><label className="small fw-bold">รหัสผ่าน {editUser ? '(เว้นว่างถ้าไม่เปลี่ยน)' : '*'}</label><input type="password" className="form-control" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
                <div className="row g-2 mb-3">
                  <div className="col-6"><label className="small fw-bold">บทบาท</label><select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="vhv">อสม.</option><option value="staff">เจ้าหน้าที่</option><option value="manager">ผู้บริหาร</option><option value="admin">Admin</option></select></div>
                  {form.role === 'vhv' && <div className="col-6"><label className="small fw-bold">หมู่รับผิดชอบ</label><input type="text" className="form-control" value={form.moo} onChange={e=>setForm({...form,moo:e.target.value})} placeholder="1,2,3"/></div>}
                </div>
                {editUser && <div className="form-check"><input className="form-check-input" type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/><label className="form-check-label small">เปิดใช้งาน</label></div>}
              </div>
              <div className="modal-footer bg-light"><button className="btn btn-outline-secondary rounded-pill" onClick={()=>setShowModal(false)}>ยกเลิก</button><button className="btn btn-primary fw-bold rounded-pill px-4" onClick={submitUser}><i className="fa-solid fa-save me-1"/>บันทึก</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
