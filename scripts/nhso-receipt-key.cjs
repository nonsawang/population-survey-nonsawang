const {execFileSync}=require('node:child_process');
const path=require('node:path');
function protectedKey(file,{create=false}={}){
 if(process.platform!=='win32')throw Error('WINDOWS_DPAPI_REQUIRED');
 const script=path.join(__dirname,'nhso-receipt-key.ps1');
 const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 try{
 const output=execFileSync(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',script,'-KeyPath',path.resolve(file),...(create?['-Create']:[])],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:30000});
 if(create)return;
 const key=Buffer.from(output.trim(),'base64');if(key.length!==32)throw Error();return key;
 }catch{throw Error('RECEIPT_KEY_ACCESS_FAILED');}
}
module.exports={protectedKey};

