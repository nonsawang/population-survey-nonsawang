const assert=require('node:assert/strict');const {loadCloseInput,processCloseIntent}=require('../scripts/nhso-close-live-loader.cjs');
function cid(s){let n=0;for(let i=0;i<12;i++)n+=+s[i]*(13-i);return s+(11-n%11)%10}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const snapshot={intent_id:'fixture',preparation_id:'prep',vn:'vn',cid:cid('123456789012'),screen_date:date,result:'ปกติ',actor_id:'actor'};
const client={rpc:async()=>({data:snapshot})};const config={hcode:'05080',token:'fixture',department:{code:'01',name:'fixture'},sourceId:'fixture',recorders:{actor:cid('987654321098')}};
let change={},entitlement='UCS';const db={execute:async(sql)=>{
 if(sql.includes('FROM survey_fit_import_ledger'))return [[{vn:'vn',cid:snapshot.cid,screen_date:date,lab_result:'Negative',vsttime:'00:00:00',labs:1,fees:1,total:60,rights:1,closed:0,...change}]];
 if(sql.includes('FROM nhso_authencode'))return [[{maininscl:entitlement}]];
 if(sql.includes('FROM vn_stat'))return [[{paid_money:0,uc_money:60}]];throw Error('SQL');}};
(async()=>{assert.equal((await loadCloseInput({client,db,intentId:'fixture',config})).input.claimServiceCode,'PG0060001');
 for(const x of [{vn:'other'},{cid:'other'},{lab_result:'Positive'},{fees:0},{total:80},{closed:1},{rights:2}]){change=x;await assert.rejects(loadCloseInput({client,db,intentId:'fixture',config}),/MISMATCH/)}
 change={};entitlement='PP';await assert.rejects(loadCloseInput({client,db,intentId:'fixture',config}),/ENTITLEMENT/);
 await assert.rejects(processCloseIntent({}),/DISABLED/);
 console.log('PASS: live loader SQL adapter fixtures; identity/result/amount/existing closure/rights checks and default disabled');
})().catch(e=>{console.error(e);process.exitCode=1});
