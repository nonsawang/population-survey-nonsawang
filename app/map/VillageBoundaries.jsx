'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleMarker, Polygon, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '@/lib/auth';
import { VALID_MOOS } from '@/lib/utils';
import { BOUNDARY_COLORS, emptyBoundaries, parseBoundaries, makeBoundary, leafletPositions } from '@/lib/village-boundaries';
import styles from './boundaries.module.css';

function Drawing({active,onPoint}) {
  useMapEvents({click:event=>{if(active)onPoint(event.latlng)}});
  return null;
}
export default function VillageBoundaries() {
  const map=useMap(); const {user}=useAuth();
  const canEdit=['staff','admin'].includes(user?.role);
  const identity=user?.userId || user?.username || '';
  const storageKey=identity?`village-boundaries-draft-v1:${identity}`:null;
  const [published,setPublished]=useState(emptyBoundaries);
  const [drafts,setDrafts]=useState(emptyBoundaries);
  const [loadedKey,setLoadedKey]=useState(null);
  const [open,setOpen]=useState(false),[visible,setVisible]=useState(true);
  const [moo,setMoo]=useState(VALID_MOOS[0]),[name,setName]=useState(''),[source,setSource]=useState('');
  const [drawing,setDrawing]=useState(false),[points,setPoints]=useState([]);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[baseError,setBaseError]=useState('');
  const panel=useRef(null),fileInput=useRef(null);
  const currentKey=useRef(storageKey);currentKey.current=storageKey;
  const local=canEdit && storageKey===loadedKey?drafts:emptyBoundaries();
  useEffect(()=>{
    let cancelled=false;
    fetch('/village-boundaries.geojson',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()})
      .then(value=>{if(!cancelled)setPublished(parseBoundaries(value,VALID_MOOS))})
      .catch(()=>{if(!cancelled)setBaseError('โหลดแนวเขตส่วนกลางไม่สำเร็จ กรุณาลองเปิดหน้าใหม่')});
    return ()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    setDrawing(false);setPoints([]);setNotice('');setError('');setLoadedKey(null);setDrafts(emptyBoundaries());
    if(!canEdit || !storageKey)return;
    try { const saved=localStorage.getItem(storageKey);setDrafts(saved?parseBoundaries(JSON.parse(saved),VALID_MOOS):emptyBoundaries()); }
    catch {setError('อ่านร่างบนเครื่องนี้ไม่ได้ สามารถนำเข้าไฟล์ที่ส่งออกไว้ได้');}
    setLoadedKey(storageKey);
  },[canEdit,storageKey]);
  useEffect(()=>{
    const el=panel.current;if(!el)return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return ()=>L.DomEvent.off(el);
  },[]);
  function persist(next) {
    try {localStorage.setItem(storageKey,JSON.stringify(next));setDrafts(next);setError('');return true;}
    catch {setError('บันทึกไม่ได้ พื้นที่เก็บข้อมูลเบราว์เซอร์อาจเต็ม กรุณาส่งออกร่างเดิมก่อน');return false;}
  }
  const byMoo=new Map(published.features.map(f=>[f.properties.moo,{feature:f,local:false}]));
  for(const f of local.features)byMoo.set(f.properties.moo,{feature:f,local:true});
  const features=[...byMoo.values()];
  function save() {
    try {
      const feature=makeBoundary(moo,name||`หมู่ ${moo}`,source,points,VALID_MOOS);
      if(persist({type:'FeatureCollection',features:[...local.features.filter(f=>f.properties.moo!==moo),feature]})) {
        setDrawing(false);setPoints([]);setNotice(`บันทึกร่างหมู่ ${moo} บนเครื่องนี้แล้ว กรุณาส่งออกเก็บไว้ด้วย`);
      }
    } catch(e){setError(e.message)}
  }
  async function importFile(event) {
    const file=event.target.files?.[0],keyAtStart=storageKey;event.target.value='';
    if(!file)return;
    try {
      if(file.size>2*1024*1024)throw Error('ไฟล์ต้องไม่เกิน 2 MB');
      const data=parseBoundaries(JSON.parse(await file.text()),VALID_MOOS);
      if(keyAtStart!==currentKey.current)return;
      if(!data.features.length)throw Error('ไฟล์ไม่มีพื้นที่แนวเขต');
      const duplicates=data.features.filter(f=>local.features.some(d=>d.properties.moo===f.properties.moo));
      if(duplicates.length && !window.confirm(`แทนร่างเดิมของหมู่ ${duplicates.map(f=>f.properties.moo).join(', ')} ด้วยข้อมูลในไฟล์?`))return;
      const merged=new Map(local.features.map(f=>[f.properties.moo,f]));data.features.forEach(f=>merged.set(f.properties.moo,f));
      if(persist({type:'FeatureCollection',features:[...merged.values()]}))setNotice(`นำเข้า ${data.features.length} หมู่เป็นร่างบนเครื่องนี้แล้ว`);
    } catch(e){if(keyAtStart===currentKey.current)setError(e instanceof SyntaxError?'ไฟล์ JSON ไม่ถูกต้อง':e.message)}
  }
  function exportFile() {
    const data={type:'FeatureCollection',features:features.map(row=>row.feature)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/geo+json'}));
    const a=document.createElement('a');a.href=url;a.download=`village-boundaries-draft-${new Date().toISOString().slice(0,10)}.geojson`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice('ส่งออกแนวเขตร่างแล้ว ให้นำไปตรวจสอบกับผู้รับผิดชอบพื้นที่ก่อนใช้อ้างอิง');
  }
  function start() {
    if(drawing && !window.confirm('เริ่มวาดใหม่และล้างจุดที่ยังไม่บันทึก?'))return;
    setPoints([]);setDrawing(true);setVisible(true);setError('');setNotice('คลิกแผนที่ตามลำดับรอบพื้นที่ อย่างน้อย 3 จุด แล้วกดบันทึกร่าง');
  }
  function cancel() {setDrawing(false);setPoints([]);setNotice('ยกเลิกจุดที่ยังไม่บันทึกแล้ว')}
  function focus(feature) {
    const coords=feature.geometry.type==='Polygon'?feature.geometry.coordinates.flat():feature.geometry.coordinates.flat(2);
    map.fitBounds(coords.map(([lng,lat])=>[lat,lng]),{padding:[30,30],maxZoom:16});
  }
  return <>
    <Drawing active={drawing && canEdit && storageKey===loadedKey} onPoint={point=>setPoints(list=>list.length<999?[...list,{lat:point.lat,lng:point.lng}]:list)} />
    {visible && features.map(({feature,local:isLocal})=><Polygon key={`${feature.properties.moo}-${isLocal}`} positions={leafletPositions(feature.geometry)} pathOptions={{color:BOUNDARY_COLORS[VALID_MOOS.indexOf(feature.properties.moo)%BOUNDARY_COLORS.length],weight:3,fillOpacity:.12,dashArray:isLocal?'7 5':undefined}} interactive={!drawing}>
      <Tooltip sticky>หมู่ {feature.properties.moo} • {feature.properties.name}<br/>{isLocal?'ร่างบนเครื่องนี้':'แนวเขตส่วนกลาง'}<br/>ที่มา: {feature.properties.source}</Tooltip>
    </Polygon>)}
    {drawing && points.length>0 && <><Polyline positions={points.map(p=>[p.lat,p.lng])} pathOptions={{color:'#e11d48',dashArray:'6 4'}} interactive={false}/>{points.map((p,i)=><CircleMarker key={i} center={[p.lat,p.lng]} radius={5} pathOptions={{color:'#e11d48'}} interactive={false}/>)}</>}
    <div className={styles.tools} ref={panel}>
      <button className={styles.toggle} aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(!open)}}>อาณาเขตหมู่บ้าน {open?'▴':'▾'}</button>
      {open && <section className={styles.panel} aria-label="เครื่องมืออาณาเขตหมู่บ้าน">
        <h2>พื้นที่รับผิดชอบแต่ละหมู่</h2>
        <p>{published.features.length?'แนวเขตส่วนกลางแสดงตามไฟล์ที่ผู้ดูแลนำเข้า':'ยังไม่มีแนวเขตส่วนกลาง — ไม่ได้ประมาณแนวเขตจากตำแหน่งบ้าน'}</p>
        {baseError && <p role="alert" className={styles.error}>{baseError}</p>}
        <label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> แสดงชั้นอาณาเขต</label>
        {features.length>0 && <div className={styles.villages}>{features.map(({feature,local:isLocal})=><button key={feature.properties.moo} onClick={()=>focus(feature)}><span style={{color:BOUNDARY_COLORS[VALID_MOOS.indexOf(feature.properties.moo)%BOUNDARY_COLORS.length]}}>●</span> หมู่ {feature.properties.moo}{isLocal?' (ร่าง)':''}</button>)}</div>}
        {canEdit && <>
          <hr/><p className={styles.draftNote}>ร่างเก็บเฉพาะบัญชีนี้ในเบราว์เซอร์เครื่องนี้ ยังไม่เผยแพร่ให้ผู้ใช้อื่น และอาจหายเมื่อล้างข้อมูลเบราว์เซอร์ ควรส่งออกไฟล์เก็บไว้</p>
          <label>หมู่บ้าน<select value={moo} disabled={drawing} onChange={e=>{setMoo(e.target.value);setName('')}}>{VALID_MOOS.map(m=><option key={m} value={m}>หมู่ {m}</option>)}</select></label>
          <label>ชื่อพื้นที่<input value={name} maxLength={120} placeholder={`หมู่ ${moo}`} onChange={e=>setName(e.target.value)}/></label>
          <label>ที่มา / ผู้จัดทำร่าง<input value={source} maxLength={300} placeholder="เช่น ร่างโดยเจ้าหน้าที่ รอตรวจแนวเขต" onChange={e=>setSource(e.target.value)}/></label>
          {byMoo.has(moo) && <p>มีแนวเขตหมู่ {moo} อยู่แล้ว การบันทึกจะใช้ร่างใหม่แทนบนเครื่องนี้</p>}
          <div className={styles.actions}><button disabled={loadedKey!==storageKey} onClick={start}>{drawing?'เริ่มวาดใหม่':'เริ่มวาดแนวเขต'}</button>{drawing && <><button disabled={!points.length} onClick={()=>setPoints(p=>p.slice(0,-1))}>ย้อนจุดล่าสุด</button><button disabled={points.length<3 || !source.trim()} onClick={save}>บันทึกร่าง ({points.length} จุด)</button><button onClick={cancel}>ยกเลิกวาด</button></>}</div>
          {drawing && <p role="status">กำลังวาดหมู่ {moo} — คลิกแผนที่รอบแนวเขต ไม่ต้องคลิกจุดแรกซ้ำ ระบบปิดวงให้เมื่อบันทึก</p>}
          <input ref={fileInput} type="file" accept=".geojson,.json,application/geo+json,application/json" hidden onChange={importFile}/>
          <div className={styles.actions}><button disabled={drawing || loadedKey!==storageKey} onClick={()=>fileInput.current?.click()}>นำเข้า GeoJSON</button><button disabled={!features.length || drawing} onClick={exportFile}>ส่งออกแนวเขต</button></div>
          {local.features.some(f=>f.properties.moo===moo) && <button disabled={drawing} onClick={()=>{if(window.confirm(`ลบร่างหมู่ ${moo} บนเครื่องนี้? ควรส่งออกเก็บไว้ก่อน`)){if(persist({type:'FeatureCollection',features:local.features.filter(f=>f.properties.moo!==moo)}))setNotice('ลบร่างบนเครื่องนี้แล้ว')}}}>ลบร่างหมู่ {moo}</button>}
          {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        </>}
      </section>}
    </div>
  </>;
}
