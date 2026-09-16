const assert=require('node:assert/strict');
const {requireServiceKey}=require('../scripts/lan-service-key.cjs');
const fakeJwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
for(const key of ['',undefined,'sb_publishable_example',fakeJwt('anon'),fakeJwt('authenticated'),'broken.jwt.value'])assert.throws(()=>requireServiceKey(key),/SUPABASE_SERVICE_KEY_REQUIRED/);
assert.doesNotThrow(()=>requireServiceKey(fakeJwt('service_role')));
assert.doesNotThrow(()=>requireServiceKey('sb_secret_synthetic_test_key'));
console.log('PASS: LAN connector rejects anon, authenticated, publishable and malformed keys before querying');
