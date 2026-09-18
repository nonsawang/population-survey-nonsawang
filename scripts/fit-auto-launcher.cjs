const fs=require('node:fs'),path=require('node:path');
const optionsFile=path.resolve(__dirname,'../lan-runtime/auto.json');
async function cycle(){
 const options=JSON.parse(fs.readFileSync(optionsFile,'utf8').replace(/^\uFEFF/,''));if(!options.enabled)return;
 process.env.NODE_PATH=options.nodePath;require('node:module').Module._initPaths();
 const log=path.join(path.dirname(optionsFile),'auto.log');
 function append(value){if(fs.existsSync(log)&&fs.statSync(log).size>1048576)fs.renameSync(log,log+'.previous');fs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),...value})+'\n');}
 try{const {readConfig}=require('./refresh-hosxp-review.cjs');const {run}=require('./hosxp-fit-auto.cjs');append(await run(readConfig(path.resolve(__dirname,'../.env.sync')),optionsFile));}
 catch(e){append({error:/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'AUTO_CYCLE_FAILED'});process.exitCode=1;}
}
(async()=>{do{await cycle();if(!process.argv.includes('--watch'))break;
 const options=JSON.parse(fs.readFileSync(optionsFile,'utf8').replace(/^\uFEFF/,''));if(!options.enabled)break;
 await new Promise(resolve=>setTimeout(resolve,60000));
}while(true);})().catch(()=>{console.error('AUTO_CONFIG_FAILED');process.exitCode=1;});
