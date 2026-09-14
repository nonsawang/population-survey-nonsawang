const assert=require('node:assert/strict');
const {verify}=require('../scripts/hosxp-fit-preflight.cjs');
const good={lab:[{lab_items_name:'fit test',icode:'3905544',active_status:'Y',possible_value:'Negative\r\nPositive'}],fee:[{name:'Fit test',istatus:'Y'}],department:[{department:'ฝ่ายส่งเสริมสุขภาพ'}],specialty:[{name:'อื่น ๆ'}],doctor:[{name:'กฤตพล',active:'Y'}],diagnosis:[{code:'Z121'}],engines:['ovst','vn_stat','lab_head','lab_order','opitemrece','ovstdiag','serial'].map(table_name=>({table_name,engine:'InnoDB'}))};
assert.equal(verify(good).catalogVerified,true);
assert.equal(verify(good).importEnabled,false);
for(const [field,change] of [
 ['lab',[]],['lab',[{...good.lab[0],icode:'3001246'}]],
 ['lab',[{...good.lab[0],possible_value:'Unknown'}]],
 ['doctor',[{name:'กฤตพล',active:'N'}]],['department',[{department:'อื่น'}]],
 ['engines',good.engines.map(r=>({...r,engine:'MyISAM'}))]
])assert.equal(verify({...good,[field]:change}).catalogVerified,false,field);
console.log('FIT preflight: mapping drift, inactive provider, result values and transaction engines checked.');
