const assert=require('node:assert/strict');
const {writeFitAuth}=require('../scripts/hosxp-fit-auth-writeback.cjs');
const closure={id:'fixture-id',state:'confirmed',zone:'test',hcode:'05080',seq:'fixture-seq',visit_number:'fixture-vn',authen_code:'fixture-auth'};
const context={closure,preparationId:'fixture-job',hcode:'05080',isolatedTestDatabase:true};
function database({auth=null,rows=1,vn='fixture-vn',engine='InnoDB',lostCommit=false}={}){
 let saved=auth,backup,updates=0;
 return {get auth(){return saved},get updates(){return updates},
 async beginTransaction(){backup=saved},async rollback(){if(!lostCommit)saved=backup},
 async commit(){if(lostCommit){lostCommit=false;backup=saved;throw Error('CONNECTION_LOST')}},
 async execute(sql,args){
  if(sql.includes('information_schema'))return [[{ENGINE:engine},{ENGINE:engine}]];
  if(sql.includes('survey_fit_import_ledger'))return [[{vn}]];
  if(sql.startsWith('SELECT auth_code'))return [Array.from({length:rows},()=>({auth_code:saved}))];
  if(sql.startsWith('UPDATE visit_pttype')){updates++;saved=args[0];return [{affectedRows:1}]}
  throw Error('UNEXPECTED_SQL');
 }};
}
(async()=>{
 const db=database();assert.equal((await writeFitAuth(db,context)).replayed,false);
 assert.equal((await writeFitAuth(db,context)).replayed,true);assert.equal(db.updates,1);
 for(const opts of [{auth:'other'},{rows:0},{rows:2},{vn:'other'},{engine:'MyISAM'}]){
  const d=database(opts);await assert.rejects(writeFitAuth(d,context));assert.equal(d.updates,0);
 }
 await assert.rejects(writeFitAuth(database(),{...context,isolatedTestDatabase:false}),/LIVE_DISABLED/);
 for(const change of [{state:'reserved'},{zone:'production'},{hcode:'99999'},{seq:null}])await assert.rejects(writeFitAuth(database(),{...context,closure:{...closure,...change}}));
 const lost=database({lostCommit:true});await assert.rejects(writeFitAuth(lost,context),/CONNECTION_LOST/);
 assert.equal((await writeFitAuth(lost,context)).replayed,true);assert.equal(lost.updates,1);
 console.log('PASS: auth writeback, replay, conflicting code, wrong visit, ambiguous rights, engines and lost commit acknowledgement');
})().catch(e=>{console.error(e);process.exitCode=1});
