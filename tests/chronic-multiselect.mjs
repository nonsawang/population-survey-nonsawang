import assert from 'node:assert/strict';
import {chronicDraft,serializeChronic,parseChronicList,diseaseCount,NORMAL} from '../lib/chronic.mjs';
import {normalizePersonRecord,isMultiChronicResident} from '../lib/proactive-dashboard.mjs';
import {severity} from '../lib/health-gis.mjs';
assert.equal(chronicDraft('-').normal,false);
assert.equal(serializeChronic(chronicDraft('')), '-');
assert.equal(serializeChronic(chronicDraft('ปกติ')),NORMAL);
const legacy=chronicDraft('ความดัน+เบาหวาน (HT+DM)');
assert.deepEqual(legacy.selected,['ความดันโลหิตสูง (HT)','เบาหวาน (DM)']);
assert.equal(serializeChronic({...legacy,other:'เกาต์, เกาต์'}),'ความดันโลหิตสูง (HT), เบาหวาน (DM), เกาต์');
for (const label of ['หัวใจ/หลอดเลือด','ถุงลมโป่งพอง/หอบหืด','จิตเวช+ยาเสพติด']) {
 assert.deepEqual(parseChronicList(label),[label]);
 assert.equal(serializeChronic(chronicDraft(label)),label);
}
assert.equal(diseaseCount(parseChronicList('หลอดเลือดสมอง (Stroke), ผู้ป่วยติดเตียง')),1);
assert.equal(serializeChronic({normal:true,selected:['เบาหวาน (DM)'],other:''}),'เบาหวาน (DM)');
for(const typ of ['1','3','2']) {
 const r=normalizePersonRecord({chronic:serializeChronic(legacy),residency_type:typ});
 assert.equal(isMultiChronicResident(r),typ!=='2');
 assert.equal(severity([{norm:r}]),typ!=='2'?'red':'orange');
}
const bed=normalizePersonRecord({chronic:'หลอดเลือดสมอง (Stroke), ผู้ป่วยติดเตียง',residency_type:'1'});
assert.equal(isMultiChronicResident(bed),false);
assert.equal(severity([{norm:bed}]),'red');
console.log('PASS legacy, multi-select serialization, unknown/normal, deduplication, care status and Dashboard/GIS agreement');
