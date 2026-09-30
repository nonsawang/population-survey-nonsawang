const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {transform,loadBindings}=require('next/dist/build/swc');
const root=path.resolve(__dirname,'..');
const {NextResponse}=require('next/server');
const modules={}; let cookie='';
async function load(file){
 const {code}=await transform(fs.readFileSync(path.join(root,file),'utf8'),{filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022'},module:{type:'commonjs'}});
 const m={exports:{}};
 new Function('require','module','exports',code)(name=>{
  if(name==='server-only')return {};
  if(name==='next/headers')return {cookies:async()=>({get:()=>({value:cookie})})};
  if(name==='next/server')return {NextResponse};
  if(name==='@/lib/server-auth')return modules.auth;
  if(name==='./preview-database.cjs')return require('../lib/preview-database.cjs');
  if(name==='@/lib/authen-report-xlsx.cjs')return require('../lib/authen-report-xlsx.cjs');
  return require(name);
 },m,m.exports);return m.exports;
}
(async()=>{
 await loadBindings();
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-anon';
 process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-service';
 process.env.LINE_LOGIN_CHANNEL_ID='fixture-channel';
 modules.auth=await load('lib/server-auth.js');
 const login=await load('app/api/auth/login/route.js');
 const line=await load('app/api/auth/line/route.js');
 const data=await load('app/api/data/[...path]/route.js');
 const calls=[];let validSession=true,validLine=true,rows=[{person_id:'synthetic'}];
 global.fetch=async(input,options={})=>{
  const url=String(input); calls.push({url,...options});
  const json=body=>Response.json(body);
  if(url.includes('/oauth2/v2.1/verify'))return json({client_id:validLine?'fixture-channel':'other-channel',expires_in:3600});
  if(url.endsWith('/v2/profile'))return json({userId:'verified-line',pictureUrl:'https://example.org/avatar.png'});
  if(url.endsWith('/app_current_user'))return json(validSession?{userId:'fixture-user',role:'vhv',moo:'1'}:null);
  if(url.endsWith('/app_auth_line')||url.endsWith('/app_auth_password'))return json({user:{userId:'fixture-user',role:'vhv',moo:'1'}});
  return json(rows);
 };
 const request=(url,body,origin='https://app.test',extra={})=>new Request('https://app.test'+url,{method:body===undefined?'GET':'POST',headers:{origin,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let res=await login.POST(request('/api/auth/login',{username:'u',password:'p'},'https://evil.test'));
 assert.equal(res.status,403);assert.equal(calls.length,0);
 res=await login.POST(request('/api/auth/login',{username:'u',password:'p',role:'admin',lineAccessToken:'test-token',lineId:'forged-line'}));
 assert.equal(res.status,200);
 const body=await res.json();assert.equal(body.user.role,'vhv');assert.equal(body.token,undefined);
 assert.match(res.headers.get('set-cookie'),/HttpOnly/i);assert.match(res.headers.get('set-cookie'),/SameSite=lax/i);
 const authCall=calls.find(x=>x.url.endsWith('/app_auth_password'));
 assert.equal(JSON.parse(authCall.body).p_line_id,'verified-line');
 assert.equal(authCall.headers.apikey,'fixture-service');assert(!JSON.stringify(body).includes('fixture-service'));
 validLine=false;const before=calls.filter(x=>x.url.endsWith('/app_auth_line')).length;
 res=await line.POST(request('/api/auth/line',{accessToken:'test-token',userId:'forged'}));assert.equal(res.status,400);
 assert.equal(calls.filter(x=>x.url.endsWith('/app_auth_line')).length,before);
 console.log('PASS: same-origin guard, server-verified LINE channel and identity, HttpOnly session, no token/key in response');
 res=await data.GET(request('/api/data/population'),{params:Promise.resolve({path:['population']})});assert.equal(res.status,401);
 cookie='a'.repeat(64);
 res=await data.GET(request('/api/data/population?moo=eq.2',undefined,'https://app.test',{'x-app-session':'forged',Authorization:'Bearer fake'}),{params:Promise.resolve({path:['population']})});
 assert.equal(res.status,200);
 const forwarded=calls.at(-1);assert.equal(forwarded.headers['x-app-session'],cookie);assert.equal(forwarded.headers.apikey,'fixture-anon');assert.equal(forwarded.headers.Authorization,'Bearer fixture-anon');
 res=await data.POST(request('/api/data/rpc/app_auth_line',{p_line_id:'forged'}),{params:Promise.resolve({path:['rpc','app_auth_line']})});assert.equal(res.status,404);
 res=await data.GET(request('/api/data/app_private.sessions'),{params:Promise.resolve({path:['app_private.sessions']})});assert.equal(res.status,404);
 validSession=false;res=await data.GET(request('/api/data/population'),{params:Promise.resolve({path:['population']})});assert.equal(res.status,401);
 validSession=true;rows=[];
 const patch=new Request('https://app.test/api/data/population?person_id=eq.other',{method:'PATCH',headers:{origin:'https://app.test','Content-Type':'application/json'},body:'{"house":"test"}'});
 res=await data.PATCH(patch,{params:Promise.resolve({path:['population']})});assert.equal(res.status,409);
 console.log('PASS: anonymous/expired requests denied, spoofed headers discarded, privileged RPCs not proxied, empty writes not reported as success');
 process.env.APP_READ_ONLY='true';
 const beforeWrites=calls.length;
 for(const name of ['person_identity_request','authen_report_accept','authen_report_refresh','hosxp_fit_prepare','screening_review_approve','hosxp_review_open_session','hosxp_review_approve','app_admin_save_user','app_change_password','unknown_future_rpc']) {
  res=await data.POST(request('/api/data/rpc/'+name,{}),{params:Promise.resolve({path:['rpc',name]})});assert.equal(res.status,403,name);assert.equal((await res.json()).code,'READ_ONLY_MODE');
 }
 for(const method of ['POST','PATCH'])for(const table of ['population','app_users','activity_logs','vhv_data']) {
  res=await data[method](new Request('https://app.test/api/data/'+table,{method,headers:{origin:'https://app.test','Content-Type':'application/json'},body:'{}'}),{params:Promise.resolve({path:[table]})});assert.equal(res.status,403);
 }
 const upload=await load('app/api/authen-report/route.js');
 assert.equal((await upload.POST(request('/api/authen-report',{}))).status,403);
 assert.equal((await line.POST(request('/api/auth/line',{accessToken:'fixture'}))).status,403);
 assert.equal((await login.POST(request('/api/auth/login',{username:'u',password:'p',lineAccessToken:'fixture'}))).status,403);
 assert.equal(calls.length,beforeWrites,'blocked operations must not reach Supabase or LINE');
 res=await data.POST(request('/api/data/rpc/screening_search',{}),{params:Promise.resolve({path:['rpc','screening_search']})});assert.equal(res.status,200);
 delete process.env.APP_READ_ONLY;
 console.log('PASS: read-only mode denies all mutation RPCs, table writes, upload and LINE linking before any upstream call; search still allowed');
})().catch(e=>{console.error(e);process.exitCode=1});
