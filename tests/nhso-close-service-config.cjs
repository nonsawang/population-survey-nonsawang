const assert=require('node:assert/strict');
const {resolveCloseService:resolve}=require('../scripts/nhso-close-service-config.cjs');
const scope={hcode:'05080',zone:'test',screeningType:'FOBT'};
const entry={enabled:true,api:'nhso-claim-detail',code:'fixture',reference:'mock contract',verifiedBy:'test-only'};
const config={hcode:'05080',zone:'test',services:{FOBT:entry}};
assert.equal(resolve(config,scope),'fixture');
for(const change of [{enabled:false},{api:'check-authen-status'},{code:''},{code:'x'.repeat(21)},{code:'a b'},{reference:''},{verifiedBy:''}]) {
 assert.throws(()=>resolve({...config,services:{FOBT:{...entry,...change}}},scope),/CLOSE_SERVICE_CONFIG_REQUIRED/);
}
for(const change of [{hcode:'99999'},{zone:'production'}])assert.throws(()=>resolve(config,{...scope,...change}),/CLOSE_SERVICE_SCOPE_REQUIRED/);
assert.throws(()=>resolve(config,{...scope,screeningType:'toString'}),/CLOSE_SERVICE_CONFIG_REQUIRED/);
assert.throws(()=>resolve(require('../config/nhso-close-services.example.json'),scope));
console.log('PASS: service configuration requires scope, endpoint, evidence and explicit enablement; no default code');
