const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),task='Nonsawang-FIT-AutoImport';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function action(node){return `<Exec><Command>${esc(path.join(process.env.SystemRoot||'C:\\Windows','System32','wscript.exe'))}</Command><Arguments>//B //NoLogo &quot;${esc(path.join(__dirname,'fit-auto-hidden.vbs'))}&quot; &quot;${esc(node)}&quot; &quot;${esc(path.join(__dirname,'fit-auto-launcher.cjs'))}&quot;</Arguments><WorkingDirectory>${esc(root)}</WorkingDirectory></Exec>`;}
function update(){
 if(/codexsandbox/i.test(os.userInfo().username))throw Error('Double-click Fix FIT Background.cmd in your Windows account.');
 const xml=execFileSync('schtasks.exe',['/Query','/TN',task,'/XML'],{encoding:'utf8',windowsHide:true});
 const expected=esc(path.join(__dirname,'fit-auto-launcher.cjs'));
 if(!xml.includes(expected)||(xml.match(/<Exec>/g)||[]).length!==1)throw Error('Unexpected task action. No changes made.');
 const command=xml.match(/<Command>([\s\S]*?)<\/Command>/)?.[1];
 if(command!==esc(process.execPath)&&!xml.includes('fit-auto-hidden.vbs'))throw Error('Unexpected Node executable. No changes made.');
 const runtime=path.join(root,'lan-runtime');
 fs.writeFileSync(path.join(runtime,'fit-task-before-hidden-'+Date.now()+'.xml'),'\uFEFF'+xml,'utf16le');
 const updated=xml.replace(/<Exec>[\s\S]*?<\/Exec>/,action(process.execPath));
 const file=path.join(runtime,'fit-task-hidden.xml');fs.writeFileSync(file,'\uFEFF'+updated.replace(/^\uFEFF/,''),'utf16le');
 execFileSync('schtasks.exe',['/Create','/TN',task,'/XML',file,'/F'],{stdio:'inherit',windowsHide:true});
 const verified=execFileSync('schtasks.exe',['/Query','/TN',task,'/XML'],{encoding:'utf8',windowsHide:true});
 if(!verified.includes('fit-auto-hidden.vbs')||!verified.includes('wscript.exe'))throw Error('Task verification failed.');
 console.log('Updated: future FIT runs are hidden. Schedule, account, and queue settings preserved.');
}
if(require.main===module)try{update();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={action};
