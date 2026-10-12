const {execFileSync}=require('node:child_process');
const path=require('node:path');
function readRecorder(){
 if(process.platform!=='win32')throw Error('RECORDER_WINDOWS_REQUIRED');
 try {
  const value=execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.join(__dirname,'nhso-recorder.ps1'),'-Read'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:30000}).trim();
  if(!/^\d{13}$/.test(value))throw Error();
  return value;
 }catch{throw Error('RECORDER_CONFIG_UNAVAILABLE');}
}
async function resolveRecorder(client,actorId,{read=readRecorder}={}){
 const {data:user,error}=await client.from('app_users').select('id,username,role,is_active').eq('id',actorId).single();
 if(error||!user||user.id!==actorId||user.username!=='vhv344108'||!user.is_active||!['staff','admin'].includes(user.role))throw Error('RECORDER_ACCOUNT_NOT_ALLOWED');
 const permission=await client.from('nhso_close_permissions').select('enabled').eq('user_id',actorId).single();
 if(permission.error||permission.data?.enabled!==true)throw Error('RECORDER_PERMISSION_REQUIRED');
 return read();
}
module.exports={resolveRecorder};
