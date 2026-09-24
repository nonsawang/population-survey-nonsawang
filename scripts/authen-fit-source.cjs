const {createHash}=require('node:crypto');
async function read(q){const {data,error}=await q;if(error)throw Error('AUTHEN_FIT_SOURCE_FAILED');return data;}
function match(row,people,histories,jobs,approvals){
 const base={row:row.row,status:'blocked',reasons:[...row.issues],statusUnconfirmed:row.statusUnconfirmed,matchVersion:'fit-source-v1'};
 if(row.issues.length)return base;
 if(people.length!==1||people[0]?.cid!==row.cid)return {...base,reasons:['source_cid_not_unique']};
 const p=people[0],h=histories.filter(h=>h.person_id===p.person_id&&h.kpi==='FOBT'&&h.screen_date===row.serviceDate);
 if(h.length!==1)return {...base,status:h.length?'ambiguous':'unmatched',reasons:[h.length?'multiple_fit_history':'no_fit_history']};
 const event=h[0],preps=jobs.filter(j=>j.history_id===event.id&&j.person_id===p.person_id),result=event.result==='ปกติ'?'Negative':event.result==='ผิดปกติ'?'Positive':null;
 const snapshot={historyId:event.id,personId:p.person_id,fitScreenDate:event.screen_date,fitResult:result,name:[p.fname,p.lname].join(' '),vn:null,serviceDate:row.serviceDate,serviceCode:row.serviceCode};
 if(!result||preps.length!==1||!approvals.some(a=>a.history_id===event.id))return {...base,...snapshot,reasons:['fit_not_prepared']};
 const job=preps[0];if(job.state!=='awaiting_lan_validation'||job.screen_date!==event.screen_date||job.payload?.lab_result!==result||job.payload?.source_result!==event.result)return {...base,...snapshot,reasons:['fit_source_changed']};
 const approved={...snapshot,fitPreparationId:job.id,preparationHash:createHash('sha256').update(JSON.stringify(job)).digest('hex')};
 return {...base,...approved,status:'matched',reasons:[],warnings:row.name.replace(/\s/g,'')!==snapshot.name.replace(/\s/g,'')?['name_conflict']:[],fingerprint:createHash('sha256').update(JSON.stringify([row,approved])).digest('hex')};
}
async function inspect(source,rows){const results=[];for(const row of rows){
 if(row.issues.length){results.push(match(row,[],[],[],[]));continue;}
 const people=await read(source.from('population').select('person_id,cid,fname,lname').eq('cid',row.cid).limit(2));
 const histories=people.length===1?await read(source.from('screening_history').select('id,person_id,kpi,result,screen_date').eq('person_id',people[0].person_id).eq('kpi','FOBT').eq('screen_date',row.serviceDate).limit(3)):[];
 const jobs=histories.length===1?await read(source.from('hosxp_fit_preparations').select('*').eq('history_id',histories[0].id).limit(3)):[];
 const approvals=histories.length===1?await read(source.from('screening_review').select('history_id').eq('history_id',histories[0].id).limit(2)):[];
 results.push(match(row,people,histories,jobs,approvals));}
 const counts=new Map();for(const r of results)if(r.historyId)counts.set(r.historyId,(counts.get(r.historyId)||0)+1);
 return results.map(r=>r.historyId&&counts.get(r.historyId)>1?{...r,status:'ambiguous',reasons:['multiple_report_rows_for_fit']}:r);
}
module.exports={match,inspect};
