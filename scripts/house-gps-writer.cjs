const {createHash}=require('node:crypto');
const hash=q=>createHash('sha256').update(JSON.stringify([q.id,q.house_id,q.village_id,q.moo,q.address,q.old_latitude,q.old_longitude,q.latitude,q.longitude])).digest('hex');
const fail=m=>{throw Error(m)};
async function writeGps(db,q){
 if(!q||!/^\d+$/.test(q.house_id)||!/^\d+$/.test(q.village_id)||![q.latitude,q.longitude,q.accuracy].every(Number.isFinite)||Math.abs(q.latitude)>90||Math.abs(q.longitude)>180||q.accuracy<0||q.accuracy>100)fail('INVALID_GPS');
 const [engine]=await db.execute("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('house','village','survey_house_gps_receipts')");
 if(engine.length!==3||engine.some(x=>x.ENGINE!=='InnoDB'))fail('INNODB_REQUIRED');
 await db.beginTransaction();try{
 const [receipts]=await db.execute('SELECT payload_hash FROM survey_house_gps_receipts WHERE id=?',[q.id]);
 if(receipts.length){if(receipts[0].payload_hash!==hash(q))fail('RECEIPT_CONFLICT');await db.rollback();return {replayed:true};}
 await db.execute('INSERT INTO survey_house_gps_receipts(id,house_id,payload_hash) VALUES(?,?,?)',[q.id,q.house_id,hash(q)]);
 const [rows]=await db.execute('SELECT h.house_id,h.village_id,h.address,h.latitude,h.longitude,v.village_moo FROM house h JOIN village v ON v.village_id=h.village_id WHERE h.house_id=? FOR UPDATE',[q.house_id]);
 const r=rows[0];
 if(rows.length!==1||String(r.village_id)!==q.village_id||String(r.address).trim()!==q.address||String(r.village_moo).trim()!==q.moo)fail('HOUSE_CHANGED');
 if(r.latitude!==q.old_latitude||r.longitude!==q.old_longitude)fail('GPS_CHANGED');
 const [result]=await db.execute('UPDATE house SET latitude=?,longitude=? WHERE house_id=?',[String(q.latitude),String(q.longitude),q.house_id]);
 if(result.affectedRows!==1)fail('HOUSE_CHANGED');await db.commit();return {replayed:false};
 }catch(e){await db.rollback().catch(()=>{});throw e;}
}
module.exports={writeGps,hash};
