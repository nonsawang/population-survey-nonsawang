// Run by the signed-in Windows user, not Codex's sandbox identity.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {action}=require('./hide-fit-task.cjs');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'lan-runtime');
const escapeXml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function xml({sid,node,start}){return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
<RegistrationInfo><Description>Nonsawang approved FIT LAN import, one item per minute; no claims.</Description></RegistrationInfo>
<Triggers><TimeTrigger><Repetition><Interval>PT1M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>${start}</StartBoundary><Enabled>true</Enabled></TimeTrigger><LogonTrigger><Enabled>true</Enabled><UserId>${sid}</UserId></LogonTrigger></Triggers>
<Principals><Principal id="Author"><UserId>${sid}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT10M</ExecutionTimeLimit></Settings>
<Actions Context="Author">${action(node)}</Actions></Task>`;}
function install(){
 if(/codexsandbox/i.test(os.userInfo().username))throw Error('Open Install FIT Scheduler.cmd from your normal Windows account.');
 const options=JSON.parse(fs.readFileSync(path.join(runtime,'auto.json'),'utf8').replace(/^\uFEFF/,''));
 if(!options.enabled)throw Error('Automatic import is paused. Review auto.json before installation.');
 process.env.NODE_PATH=options.nodePath;require('node:module').Module._initPaths();require.resolve('mysql2/promise');require.resolve('@supabase/supabase-js');
 const sid=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-[0-9-]+/)?.[0];if(!sid)throw Error('Cannot identify signed-in Windows user.');
 const file=path.join(runtime,'fit-task.xml'),task='Nonsawang-FIT-AutoImport';
 fs.writeFileSync(file,'\uFEFF'+xml({sid,node:process.execPath,start:new Date(Date.now()+60000).toISOString()}),'utf16le');
 // No /F: never silently replace another installed task.
 execFileSync('schtasks.exe',['/Create','/TN',task,'/XML',file],{stdio:'inherit'});
 execFileSync('schtasks.exe',['/Run','/TN',task],{stdio:'inherit'});
 execFileSync('schtasks.exe',['/Query','/TN',task,'/FO','LIST','/V'],{stdio:'inherit'});
 console.log('Task registered and start requested. Check lan-runtime/auto.log for completion. Existing queue settings are unchanged.');
}
if(require.main===module)try{install();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={xml};
