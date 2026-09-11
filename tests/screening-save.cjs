const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../lib/screening-save.js'),'utf8');
 const {createScreeningSaver,screeningPayload,screeningFields}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const db=new PGlite();
 await db.exec('CREATE TABLE population(person_id text PRIMARY KEY,updated_at timestamptz,hep_screen text,hep_date date,fobt_screen text,fobt_date date,hpv_screen text,hpv_date date,child_dev text,child_date date); INSERT INTO population(person_id) VALUES(\'fixture\');');
 let writes=0,fail=false,readFail=false;
 const client={from(){let body,id,cols;return {
 update(v){body=v;return this},eq(k,v){id=v;return this},
 select(v){cols=v;if(!body)return this;writes++; if(fail)return Promise.reject(new Error('network failed'));
 const keys=Object.keys(body);return db.query(`UPDATE population SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE person_id=$${keys.length+1} RETURNING person_id`,[...Object.values(body),id]).then(r=>({data:r.rows}));},
 async single(){if(readFail)return {error:{message:'timeout'}};const r=await db.query(`SELECT ${cols} FROM population WHERE person_id=$1`,[id]);const row=r.rows[0]; if(row) for(const k of Object.keys(row)) if(row[k] instanceof Date) row[k]=row[k].toISOString().slice(0,10); return {data:row};}
 }}};
 const save=createScreeningSaver(client);
 for(const type of Object.keys(screeningFields)) {
   const result=type==='CHILD'?'สมวัย':'ปกติ';
   await save({personId:'fixture',type,result,date:'2025-01-15'});
   const row=(await db.query('SELECT * FROM population')).rows[0];
   const [f,d]=screeningFields[type];assert.equal(row[f],result);assert.equal(row[d] instanceof Date?row[d].toISOString().slice(0,10):row[d],'2025-01-15');
 }
 for(const date of ['', '2025-02-30','2999-01-01']) assert.throws(()=>screeningPayload('FOBT','ปกติ',date));
 assert.throws(()=>screeningPayload('CHILD','ปกติ','2025-01-01'));
 fail=true;await assert.rejects(()=>save({personId:'fixture',type:'FOBT',result:'ปกติ',date:'2025-01-01'})); fail=false;
 const before=writes; const input={personId:'fixture',type:'FOBT',result:'ผิดปกติ',date:'2025-02-01'};
 const results=await Promise.all([save(input),save(input)]);assert.equal(writes,before+1);assert.equal(results[1],null);
 await assert.rejects(()=>save({...input,personId:'missing'}));
 readFail=true; await assert.rejects(()=>save(input),/ยืนยันผล/); readFail=false; await save(input);
 await db.close();console.log('PASS: four KPI write/read-back dates and results, invalid/future dates, invalid result, duplicate guard, retry after failure, zero-row failure');
})().catch(e=>{console.error(e);process.exit(1)});
