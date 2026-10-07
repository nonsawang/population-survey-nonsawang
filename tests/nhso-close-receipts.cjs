const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {receiptStore}=require('../scripts/nhso-close-receipts.cjs');
const {retryRecord}=require('../scripts/nhso-close-dispatch.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nhso-receipt-test-'));
 try{
  const key=crypto.randomBytes(32),receipt={id:'fixture',owner:'owner',simulated:true,state:'confirmed',seq:'seq',code:'MOCK-SECRET'};
  receiptStore(dir,key).save(receipt);
  const disk=fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0]),'utf8');assert.ok(!disk.includes('MOCK-SECRET'));
  const recovered=receiptStore(dir,key).load('fixture');assert.deepEqual(recovered,receipt);
  let records=0;
  const result=await retryRecord(recovered,{ledger:{record:async r=>{records++;assert.deepEqual(r,receipt);}}});
  assert.equal(result.status,'recorded');assert.equal(records,1);
  assert.throws(()=>receiptStore(dir,crypto.randomBytes(32)).load('fixture'),/INVALID/);
  const file=path.join(dir,fs.readdirSync(dir)[0]),data=JSON.parse(disk);data.tag=Buffer.alloc(16).toString('base64');fs.writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>receiptStore(dir,key).load('fixture'),/INVALID/);
  console.log('PASS: encrypted receipt recovery, record-only retry, wrong key and tampering rejected');
 }finally{for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}
})().catch(e=>{console.error(e);process.exitCode=1;});
