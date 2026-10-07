const fs=require('node:fs');
const path=require('node:path');
const {createCipheriv,createDecipheriv,randomBytes,createHash}=require('node:crypto');
function receiptStore(directory,key){
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('RECEIPT_KEY_REQUIRED');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const filename=id=>path.join(directory,createHash('sha256').update(String(id)).digest('hex')+'.receipt');
 return {
  save(receipt){
   if(receipt?.simulated!==true||!receipt.id)throw Error('INVALID_RECEIPT');
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
   cipher.setAAD(Buffer.from(String(receipt.id)));
   const ciphertext=Buffer.concat([cipher.update(JSON.stringify(receipt),'utf8'),cipher.final()]);
   const encoded=JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
   const file=filename(receipt.id),temporary=file+'.'+randomBytes(8).toString('hex')+'.tmp';
   let fd;
   try{fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,encoded);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temporary,file);}
   finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  },
  load(id){
   try{
    const encoded=JSON.parse(fs.readFileSync(filename(id),'utf8'));
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(encoded.iv,'base64'));
    decipher.setAAD(Buffer.from(String(id)));decipher.setAuthTag(Buffer.from(encoded.tag,'base64'));
    const receipt=JSON.parse(Buffer.concat([decipher.update(Buffer.from(encoded.data,'base64')),decipher.final()]).toString('utf8'));
    if(receipt.id!==id||receipt.simulated!==true)throw Error();
    return receipt;
   }catch{throw Error('RECEIPT_UNAVAILABLE_OR_INVALID');}
  }
 };
}
module.exports={receiptStore};
