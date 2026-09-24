const ExcelJS=require('exceljs');
const {normalize}=require('./authen-report.cjs');
function checkZip(buffer){
 if(buffer.length>2*1024*1024||buffer.length<22)throw Error('REPORT_FILE_LIMIT');
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('REPORT_XLSX_REQUIRED');
 const count=buffer.readUInt16LE(end+10);let pos=buffer.readUInt32LE(end+16),total=0;
 if(count>1000||count===65535||buffer.readUInt16LE(end+4)!==0)throw Error('REPORT_FILE_LIMIT');
 for(let i=0;i<count;i++){
  if(pos+46>buffer.length||buffer.readUInt32LE(pos)!==0x02014b50)throw Error('REPORT_XLSX_REQUIRED');
  total+=buffer.readUInt32LE(pos+24);if(total>16*1024*1024)throw Error('REPORT_FILE_LIMIT');
  pos+=46+buffer.readUInt16LE(pos+28)+buffer.readUInt16LE(pos+30)+buffer.readUInt16LE(pos+32);
 }
}
async function parse(buffer){
 checkZip(buffer);const w=new ExcelJS.Workbook();await w.xlsx.load(buffer);
 if(w.worksheets.length!==1)throw Error('REPORT_ONE_SHEET');
 const s=w.worksheets[0];if(s.rowCount>501||s.columnCount>50)throw Error('REPORT_ROW_LIMIT');
 const matrix=[];s.eachRow({includeEmpty:true},row=>{
  const values=[];for(let i=1;i<=s.columnCount;i++){let v=row.getCell(i).value;
   if(v&&typeof v==='object'){
    if(Object.keys(v).length===1&&Array.isArray(v.richText)&&v.richText.every(p=>typeof p.text==='string'))v=v.richText.map(p=>p.text).join('');
    else throw Error('REPORT_PLAIN_CELLS_REQUIRED');
   }values.push(v??'');}matrix.push(values);
 });return normalize(matrix);
}
module.exports={parse,checkZip};
