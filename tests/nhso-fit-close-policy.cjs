const assert=require('node:assert/strict');
const {verifyFitCloseSnapshot:verifySnapshot,nextCloseAction:next}=require('../scripts/nhso-fit-close-policy.cjs');
const serviceConfig={hcode:'05080',zone:'test',services:{FOBT:{enabled:true,api:'nhso-claim-detail',code:'fixture',reference:'mock contract',verifiedBy:'test-only'}}};
const verify=snapshot=>verifySnapshot(snapshot,{serviceConfig});
const base={actor:{id:'staff1',role:'staff',closeAllowed:true},screening:{id:'fit1',personId:'person1',cid:'fixture',type:'FOBT',savedAt:'2026-10-09',result:'ปกติ',date:'2026-10-09',revision:'v1'},visit:{vn:'fixture-vn',hcode:'05080',zone:'test',cid:'fixture',date:'2026-10-09',totalSatang:6000,paidSatang:0,privilegeSatang:6000,mainInsclCode:'UCS',claimServiceCode:'fixture',serviceMappingVerified:true},approval:{actorId:'staff1',screeningId:'fit1',vn:'fixture-vn',cid:'fixture',revision:'v1',action:'manual-close'}};
assert.equal(verify(base).serviceGroup,'PP');assert.equal(verify(base).mainInsclCode,'UCS');
for(const [section,changes]of [['actor',{role:'vhv'}],['screening',{result:''}],['screening',{savedAt:null}],['visit',{cid:'other'}],['visit',{date:'2026-10-08'}],['visit',{totalSatang:6100}],['visit',{mainInsclCode:'PP'}],['visit',{privilegeSatang:5900}],['actor',{closeAllowed:false}],['visit',{claimServiceCode:'different'}],['visit',{hcode:'99999'}],['approval',{revision:'old'}],['approval',{action:'auto-close'}]])assert.throws(()=>verify({...base,[section]:{...base[section],...changes}}));
assert.equal(next({closeState:'confirmed',hosxpState:'failed'}),'write_hosxp_only');
assert.equal(next({closeState:'confirmed',hosxpState:'written'}),'complete');
assert.equal(next({closeState:'outcome_unknown'}),'reconcile_without_resending');
console.log('PASS: saved FIT, identity/date/amount/entitlement/manual approval gates; HOSxP retry never requests closure');

assert.throws(()=>verifySnapshot(base),/CLOSE_SERVICE_SCOPE_REQUIRED/);
assert.equal(verify({...base,screening:{...base.screening,result:'ผิดปกติ'}}).claimServiceCode,'fixture');
