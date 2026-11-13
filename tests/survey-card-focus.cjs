const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/page.js', 'utf8');
const body = source.match(/useEffect\(\(\) => \{\s*(if \(results !== null\)[\s\S]*?)\n  \}, \[results, targetPerson\]\);/)[1];
for (const id of ['', 'missing', 'found']) {
  const calls = [];
  const house = {scrollIntoView(){calls.push('house');}};
  const card = {scrollIntoView(){calls.push('card');},focus(){calls.push('focus');}};
  vm.runInNewContext(body, {results:[],targetPerson:id,document:{getElementById(key){return key==='survey-house-results'?house:key==='person-card-found'?card:null;}}});
  assert.deepEqual(calls,id==='found'?['card','focus']:['house']);
}
vm.runInNewContext(body,{results:null,targetPerson:'',document:{getElementById(){throw Error('must not access DOM before results');}}});
console.log('PASS: ordinary house search, missing person, person deep link, initial loading');
