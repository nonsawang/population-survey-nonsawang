const {PGlite}=require('@electric-sql/pglite');
const {pg_trgm}=require('@electric-sql/pglite/contrib/pg_trgm');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite({extensions:{pg_trgm}});
 await db.exec(`CREATE SCHEMA extensions; CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE TABLE population(person_id text PRIMARY KEY,cid text,title text,fname text,lname text,birth_date date,house text,moo text,residency_type text,status_model_version integer,person_discharge_id integer,hep_screen text,fobt_screen text,hpv_screen text,child_dev text,hep_date date,fobt_date date,hpv_date date,child_date date);
 ALTER TABLE population ENABLE ROW LEVEL SECURITY;
 CREATE POLICY scope ON population FOR SELECT USING (current_setting('test.actor',true)='staff' OR (current_setting('test.actor',true)='vhv' AND moo='1'));
 GRANT SELECT ON population TO anon,authenticated;
 INSERT INTO population(person_id,cid,title,fname,lname,birth_date,house,moo,residency_type,status_model_version,person_discharge_id)
 SELECT lpad(i::text,3,'0'),lpad(i::text,13,'0'),'นาย','ทดสอบ','ค้นหา',current_date-interval '60 years','15',CASE WHEN i<=22 THEN '1' ELSE '2' END,'1',1,9 FROM generate_series(1,25) i;
 INSERT INTO population(person_id,title,fname,birth_date,moo,residency_type,status_model_version,person_discharge_id) VALUES
 ('dead','นาย','ทดสอบ',current_date-interval '60 years','1','1',1,1),
 ('outside','นาย','ทดสอบ',current_date-interval '60 years','1','4',1,9),
 ('female','นาง','หญิงทดสอบ',current_date-interval '30 years','1','3',1,9),
 ('child','เด็กชาย','เด็กทดสอบ',current_date-interval '5 years','1','1',1,9);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20260911_screening_search.sql'),'utf8'));
 await db.exec('SET ROLE anon');
 const search=async(k,q,m='name',p=1)=>(await db.query('select screening_search($1,$2,$3,$4) r',[k,q,m,p])).rows[0].r;
 assert.equal((await search('FOBT','ทดสอบ')).total,0);
 await db.exec("SELECT set_config('test.actor','vhv',false)");
 let r=await search('FOBT','ทดสอบ'); assert.equal(r.total,22);assert.equal(r.rows.length,20);
 assert.equal((await search('FOBT','ทดสอบ','name',2)).rows.length,2);
 assert.equal((await search('FOBT','0000000000025','cid')).total,0);
 assert.equal((await search('FOBT','๐๐๐๐๐๐๐๐๐๐๐๐๑','cid')).total,1);
 assert.equal((await search('FOBT','ค้นหา ทดสอบ')).total,22);
 assert.equal((await search('FOBT','%')).total,0);
 assert.equal((await search('FOBT','')).total,0);
 assert.equal((await search('HPV','ทดสอบ')).total,1);
 assert.equal((await search('CHILD','ทดสอบ')).total,1);
 await db.exec("SELECT set_config('test.actor','staff',false)");
 assert.equal((await search('FOBT','ทดสอบ')).total,25);
 assert.equal((await search('FOBT','0000000000025','cid')).total,1);
 await assert.rejects(()=>search('INVALID','ทดสอบ'));
 console.log('PASS: RLS anonymous/staff/vhv, exact Thai CID, multi-part name, literal wildcard, pagination, deceased/outside exclusion and KPI criteria');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
