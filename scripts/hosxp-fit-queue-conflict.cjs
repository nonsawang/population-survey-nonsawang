const CONFLICT = 'QUEUE_CONFLICT';
// Bound each query and scan all pages: never silently ignore a collision after row 1000.
async function all(build) {
 const out=[]; for(let offset=0;;offset+=100){
  const {data,error}=await build().range(offset,offset+99);
  if(error||!Array.isArray(data))throw Error('QUEUE_CONFLICT_CHECK_FAILED');
  out.push(...data);if(data.length<100)return out;
 }
}
async function queueConflict(source,job,person){
 if(!person?.cid)return null;
 const people=await all(()=>source.from('population').select('person_id').eq('cid',person.cid).order('person_id'));
 const ids=[...new Set([job.person_id,...people.map(p=>p.person_id)])];
 for(let start=0;start<ids.length;start+=100){
  const jobs=await all(()=>source.from('hosxp_fit_preparations').select('id').in('person_id',ids.slice(start,start+100)).eq('screen_date',job.screen_date).eq('state','awaiting_lan_validation').order('id'));
  for(let i=0;i<jobs.length;i+=100){
   const candidates=jobs.slice(i,i+100).filter(j=>j.id!==job.id);
   if(!candidates.length)continue;
   const {data,error}=await source.from('hosxp_fit_import_results').select('preparation_id').in('preparation_id',candidates.map(j=>j.id)).eq('import_status','imported');
   if(error||!Array.isArray(data))throw Error('QUEUE_CONFLICT_CHECK_FAILED');
   const imported=new Set(data.map(r=>r.preparation_id));
   if(candidates.some(j=>!imported.has(j.id)))return CONFLICT;
  }
 }
 return null;
}
module.exports={queueConflict,CONFLICT};
