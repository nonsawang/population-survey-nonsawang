const {setTimeout:delay}=require('node:timers/promises');
// Retry only a server-confirmed deadlock, never an ambiguous connection/commit error.
async function retryDeadlock(operation,{sleep=delay,random=Math.random}={}){
 for(let attempt=1;attempt<=3;attempt++){
  try{return await operation();}
  catch(error){
   if(error?.code!=='ER_LOCK_DEADLOCK'||Number(error.errno)!==1213)throw error;
   if(attempt===3){const exhausted=new Error('DEADLOCK_RETRY_EXHAUSTED');exhausted.cause=error;throw exhausted;}
   await sleep(100*2**(attempt-1)+Math.floor(random()*100));
  }
 }
}
module.exports={retryDeadlock};
