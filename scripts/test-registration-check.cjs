const assert=require('node:assert/strict');
const {checkRegistrations}=require('./hosxp-registration-check.cjs');
const cid='1101700207030';
// Generate a valid fixture CID, never use a real patient.
let prefix='199999999999';let sum=[...prefix].reduce((s,n,i)=>s+Number(n)*(13-i),0);const valid=prefix+((11-sum%11)%10);
async function scenario(persons,patients,expected,apply=true){let writes=0,queries=[];
const source={from(table){const q={select(){return q},in(){return q},gt(){return q},order(){return q},limit:async()=>({data:[{id:'req',person_id:'web'}]}),eq(){return q},single:async()=>({data:{person_id:'web',cid:valid,birth_date:'1980-01-01'}})};return q},rpc:async(name,args)=>{writes++;assert.equal(name,'screening_registration_ack');assert.equal(args.p_state,expected);return {data:{state:args.p_state}}}};
const db={execute:async(sql)=>{queries.push(sql);return [sql.includes('FROM person WHERE')?persons:patients]}};
const result=await checkRegistrations({source,db,apply});assert.equal(result.checked,1);assert.equal(writes,apply?1:0);assert(queries.every(q=>q.startsWith('SELECT')));
}
(async()=>{const p={person_id:1,cid:valid,patient_hn:'000000001',birthdate:'1980-01-01'},h={hn:'000000001',cid:valid,birthday:'1980-01-01'};
await scenario([],[],'requires_hosxp_registration');await scenario([], [h],'requires_hosxp_registration');await scenario([p],[h],'linked');await scenario([p,p],[h],'blocked');await scenario([{...p,birthdate:'1981-01-01'}],[h],'blocked');await scenario([p],[h],'linked',false);console.log('PASS registration check: missing, patient only, linked, duplicate, birth conflict, dry-run');
const swc=await require('next/dist/build/swc').loadBindings();const fs=require('node:fs');for(const file of ['components/RegistrationStatus.jsx','app/screening/page.js'])await swc.transform(fs.readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022'},module:{type:'es6'}});console.log('PASS JSX');
})().catch(e=>{console.error(e);process.exitCode=1});
