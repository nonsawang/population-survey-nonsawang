// HOSxP reads only. Never allocates HN/person_id or inserts a HOSxP record.
const {candidate}=require('./hosxp-registry-link.cjs');
async function checkRegistrations({source,db,apply=false}){
 const report={checked:0,linked:0,waiting:0,blocked:0};let after='';
 for(;;){
  const q=await source.from('person_registration_requests').select('id,person_id').in('state',['pending_registry_check','requires_hosxp_registration','blocked']).gt('person_id',after).order('person_id').limit(100);
  if(q.error)throw Error('REGISTRATION_QUEUE_UNAVAILABLE');if(!q.data.length)break;
  for(const request of q.data){
   const p=await source.from('population').select('person_id,cid,birth_date').eq('person_id',request.person_id).single();
   if(p.error)throw Error('REGISTRATION_PERSON_UNAVAILABLE');
   const [persons]=await db.execute('SELECT person_id,cid,patient_hn,birthdate FROM person WHERE cid=? LIMIT 2',[p.data.cid]);
   const [patients]=await db.execute('SELECT hn,cid,birthday FROM patient WHERE cid=? LIMIT 2',[p.data.cid]);
   let state='requires_hosxp_registration',code=persons.length?'PATIENT_REGISTRATION_REQUIRED':patients.length?'PERSON_REGISTRATION_REQUIRED':'HOSXP_REGISTRATION_REQUIRED',verified=null;
   if(persons.length>1||patients.length>1){state='blocked';code='IDENTITY_NOT_UNIQUE';}
   else if(persons.length===1&&patients.length===1){
    try{verified=candidate(p.data,persons,patients);state='linked';code=null;}catch(e){state='blocked';code=e.message;}
   }
   if(apply){
    const ack=await source.rpc('screening_registration_ack',{p_id:request.id,p_snapshot:p.data,p_state:state,p_code:code,p_verified:verified});
    if(ack.error)throw Error('REGISTRATION_ACK_FAILED');state=ack.data.state;
   }
   report.checked++;report[state==='linked'?'linked':state==='blocked'?'blocked':'waiting']++;
  }
  after=q.data.at(-1).person_id;if(q.data.length<100)break;
 }
 return report;
}
module.exports={checkRegistrations};
