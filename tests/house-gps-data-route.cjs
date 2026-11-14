const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/api/data/[...path]/route.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export const dynamic','const dynamic').replace(/export \{ handle[^;]+;/,'');
(async()=>{
 let calls=0,loggedIn=true;
 const context=vm.createContext({URL,Headers,Response,AbortSignal,JSON,Set,
 isReadOnly:()=>false,dataAllowed:()=>true,sameOrigin:()=>true,getSessionToken:async()=> 'test-session',currentUser:async()=>loggedIn?{role:'vhv'}:null,
 databaseConfig:()=>({url:'https://example.test',key:'fixture'}),readBody:async()=>({p_id:'fixture'}),authResponse:(body,status=200)=>Response.json(body,{status}),authError:()=>Response.json({},{status:500}),
 fetch:async(url,options)=>{calls++;assert.equal(url,'https://example.test/rest/v1/rpc/house_gps_clear_web');assert.equal(options.headers['x-app-session'],'test-session');return Response.json({cleared:true});}
 });
 vm.runInContext(source+';this.route=handle;',context);
 const req={method:'POST',url:'https://example.test/api/data/rpc/house_gps_clear_web',headers:new Headers()};
 assert.equal((await context.route(req,{params:{path:['rpc','house_gps_clear_web']}})).status,200);assert.equal(calls,1);
 loggedIn=false;assert.equal((await context.route(req,{params:{path:['rpc','house_gps_clear_web']}})).status,401);assert.equal(calls,1);
 assert.equal((await context.route(req,{params:{path:['rpc','unknown_function']}})).status,404);
 console.log('PASS: clear GPS route forwarded with session; unauthenticated and unknown RPC blocked');
})().catch(e=>{console.error(e);process.exit(1)});
