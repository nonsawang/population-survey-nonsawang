// Run on LAN: outbound HTTPS to Supabase only; never writes HOSxP.
const path=require('node:path');
const {readConfig,refresh}=require('./refresh-hosxp-review.cjs');
const {run}=require('./validate-hosxp-fit-queue.cjs');
(async()=>{
 const config=readConfig(path.resolve(__dirname,'../.env.sync'));
 await refresh(config);
 const result=await run(config);
 console.log(JSON.stringify(result,null,2));
})().catch(()=>{console.error('HYBRID_RUN_FAILED: ตรวจค่าคีย์และการเชื่อมต่อ ชุดข้อมูลที่ส่งไม่ครบจะไม่ถูกเปิดใช้งาน ไม่มีการสร้าง visit');process.exitCode=1;});
