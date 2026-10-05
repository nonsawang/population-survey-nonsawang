async function batchRows(source,table,key,values,columns,filter=q=>q){
 const ids=[...new Set(values.filter(v=>v!==null&&v!==undefined))],rows=[];
 for(let i=0;i<ids.length;i+=100){
  const part=ids.slice(i,i+100);
  for(let offset=0;;offset+=100){
   const {data,error}=await filter(source.from(table).select(columns).in(key,part)).order(key).range(offset,offset+99);
   if(error||!Array.isArray(data))throw Error('SOURCE_READ_FAILED');
   rows.push(...data);if(data.length<100)break;
  }
 }
 return rows;
}
module.exports={batchRows};
