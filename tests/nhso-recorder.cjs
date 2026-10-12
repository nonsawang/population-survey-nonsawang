const assert=require('node:assert/strict');
const {resolveRecorder}=require('../scripts/nhso-recorder.cjs');
let username='vhv344108',enabled=true,reads=0;
const client={from:table=>({select:()=>({eq:()=>({single:async()=>({data:table==='app_users'?{id:'actor',username,role:'staff',is_active:true}:{enabled}})})})})};
(async()=>{
 const read=()=>{reads++;return 'fixture-recorder'};
 assert.equal(await resolveRecorder(client,'actor',{read}),'fixture-recorder');
 username='staff1';await assert.rejects(resolveRecorder(client,'actor',{read}),/ACCOUNT_NOT_ALLOWED/);
 username='vhv344108';enabled=false;await assert.rejects(resolveRecorder(client,'actor',{read}),/PERMISSION_REQUIRED/);
 assert.equal(reads,1);
 console.log('PASS: recorder secret is loaded only for the enabled named staff account');
})().catch(()=>{console.error('FAIL: recorder authorization');process.exitCode=1});
