const assert=require('node:assert/strict');const {writeEnabled}=require('../scripts/hosxp-fit-import.cjs');
assert.equal(writeEnabled({HOSXP_IMPORT_ENABLED:'true'}),false);
process.argv.push('--write','--confirm-fit-write');assert.equal(writeEnabled({HOSXP_IMPORT_ENABLED:'false'}),false);assert.equal(writeEnabled({HOSXP_IMPORT_ENABLED:'true'}),true);
console.log('PASS: HOSxP writer remains disabled unless LAN flag and explicit CLI confirmation are both present');
