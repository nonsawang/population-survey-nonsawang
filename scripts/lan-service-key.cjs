// Local configuration sanity check only; Supabase still verifies the key.
function requireServiceKey(key){
 if(typeof key!=='string'||!key)throw new Error('SUPABASE_SERVICE_KEY_REQUIRED');
 if(key.startsWith('sb_secret_')&&key.length>20)return;
 try{
  const parts=key.split('.');
  if(parts.length===3&&JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).role==='service_role')return;
 }catch{}
 throw new Error('SUPABASE_SERVICE_KEY_REQUIRED');
}
module.exports={requireServiceKey};
