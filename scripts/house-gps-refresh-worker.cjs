const path=require('node:path');
const {spawnSync}=require('node:child_process');
async function refreshHouseReference(client,spawn=spawnSync){
 const {data:id,error}=await client.rpc('house_gps_refresh_claim');
 // Keep existing approved dispatch working before this migration is installed.
 if(error){if(['PGRST202','42883'].includes(error.code)){console.error('GPS_REFRESH_MIGRATION_REQUIRED');return;}throw Error('GPS_REFRESH_CLAIM_FAILED');}
 if(!id)return;
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('GPS_REFRESH_INVALID_ID');
 const result=spawn(process.execPath,[path.join(__dirname,'house-gps-lan.cjs'),'snapshot',id],{stdio:'inherit',windowsHide:true,timeout:300000});
 const completed=await client.rpc('house_gps_refresh_finish',{p_id:id,p_success:result.status===0&&!result.error});
 if(completed.error)throw Error('GPS_REFRESH_ACK_FAILED');
 console.log(result.status===0&&!result.error?'GPS_REFRESH_COMPLETED':'GPS_REFRESH_FAILED');
}
module.exports={refreshHouseReference};
