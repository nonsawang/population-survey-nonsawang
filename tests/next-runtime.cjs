// Run after `npm run build`. Only synthetic data and a loopback database stub.
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const path=require('node:path');
(async()=>{
 let app, output='', valid=true, requests=0;
 const db=http.createServer(async(req,res)=>{
  requests++;
  for await(const chunk of req) {} // Drain request; never log credentials.
  res.setHeader('Content-Type','application/json');
  const p=req.url.split('?')[0];
  const user={userId:'synthetic-user',role:'staff'};
  if(p.endsWith('/app_auth_password')) return res.end(JSON.stringify({user}));
  if(p.endsWith('/app_current_user')) return res.end(JSON.stringify(valid?user:null));
  if(p.endsWith('/app_logout')) {valid=false;return res.end('{}');}
  if(p==='/rest/v1/population') return res.end(JSON.stringify([{person_id:'synthetic-person'}]));
  res.statusCode=404;res.end('{}');
 });
 try {
  db.listen(54321,'127.0.0.1');await once(db,'listening');
  const port=Number(process.env.NEXT_SMOKE_PORT||3196),base=`http://localhost:${port}`;
  app=spawn(process.execPath,[path.join(__dirname,'../node_modules/next/dist/bin/next'),'start','-H','localhost','-p',String(port)],{
   cwd:path.join(__dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe'],
   env:{...process.env,NODE_ENV:'production',VERCEL_ENV:'',NEXT_TELEMETRY_DISABLED:'1',
    NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${db.address().port}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'}
  });
  app.stdout.on('data',c=>output+=c);app.stderr.on('data',c=>output+=c);
  let ready=false;
  for(let i=0;i<100;i++) {try {const r=await fetch(base+'/login');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  assert(ready,'Next did not start: '+output);
  for(const route of ['/screening','/map','/hosxp-review'])assert.equal((await fetch(base+route)).status,200);
  assert.equal((await fetch(base+'/api/data/population')).status,401);assert.equal(requests,0);
  const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  let r=await post('/api/auth/login',{username:'fixture',password:'fixture'},{origin:'https://untrusted.example'});
  assert.equal(r.status,403);assert.equal(requests,0);
  r=await post('/api/auth/login',{username:'fixture',password:'fixture'});assert.equal(r.status,200,await r.clone().text()+' '+output);
  const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);
  const headers={cookie:cookie.split(';')[0]};
  r=await fetch(base+'/api/auth/session',{headers});assert.equal((await r.json()).user.role,'staff');
  r=await fetch(base+'/api/data/population?person_id=eq.synthetic-person',{headers});
  assert.equal(r.status,200);assert.equal((await r.json())[0].person_id,'synthetic-person');assert.match(r.headers.get('cache-control'),/no-store/);
  r=await post('/api/auth/logout',{},headers);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/i);
  assert.equal((await fetch(base+'/api/data/population',{headers})).status,401);
  if(process.env.APP_READ_ONLY==='true') {
   assert.match(cookie,/population_preview_session=/);
   const before=requests;
   for(const route of ['/api/data/population','/api/data/rpc/hosxp_fit_prepare','/api/data/rpc/authen_report_accept','/api/data/rpc/person_identity_request','/api/authen-report']) {
    r=await post(route,{},headers);assert.equal(r.status,403);assert.equal((await r.json()).code,'READ_ONLY_MODE');
   }
   assert.equal(requests,before,'read-only rejection must not contact database');
  }
  console.log('PASS: Next 16 production runtime, routes, async cookies/params, CSRF, session, no-store and logout (synthetic loopback data only)');
 } finally {if(app){app.kill();await once(app,'exit').catch(()=>{});}db.closeAllConnections();await new Promise(r=>db.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
