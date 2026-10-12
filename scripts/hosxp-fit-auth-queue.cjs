const {writeFitAuth}=require('./hosxp-fit-auth-writeback.cjs');
// Client must be a trusted service-role client. IDs only; no browser-supplied evidence.
async function processAuthJob({client,db,jobId,hcode,isolatedTestDatabase=false}) {
 if(!isolatedTestDatabase)throw Error('AUTH_QUEUE_LIVE_DISABLED');
 const jobResult=await client.from('fit_auth_writeback_queue').select('id,closure_id,preparation_id,state').eq('id',jobId).single();
 if(jobResult.error||!jobResult.data)throw Error('AUTH_JOB_LOAD_FAILED');
 const job=jobResult.data;
 if(!['pending','written'].includes(job.state)||!job.preparation_id||!job.closure_id)throw Error('AUTH_JOB_INVALID');
 const evidence=await client.from('nhso_close_submissions').select('id,state,zone,hcode,visit_number,seq,authen_code').eq('id',job.closure_id).single();
 if(evidence.error||!evidence.data||evidence.data.id!==job.closure_id)throw Error('AUTH_EVIDENCE_LOAD_FAILED');
 const result=await writeFitAuth(db,{closure:evidence.data,preparationId:job.preparation_id,hcode,isolatedTestDatabase});
 // Even written jobs are read back. A lost acknowledgement must not cause remote resubmission.
 const ack=await client.from('fit_auth_writeback_queue').update({state:'written',written_at:new Date().toISOString()}).eq('id',job.id).eq('closure_id',job.closure_id).eq('preparation_id',job.preparation_id).select('id');
 if(ack.error||ack.data?.length!==1)return {...result,status:'ack_pending'};
 return result;
}
module.exports={processAuthJob};
