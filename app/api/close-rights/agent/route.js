import {authResponse,currentUser,sameOrigin,isReadOnly,readBody,dbRpc,getSessionToken} from '@/lib/server-auth';
export const dynamic='force-dynamic';
export async function POST(request){
 if(!sameOrigin(request)||isReadOnly())return authResponse({},403);
 if(process.env.NHSO_AGENT_QUEUE_ENABLED!=='true')return authResponse({error:'ยังไม่เปิดเส้นทาง Agent'},503);
 try{const token=await getSessionToken(),user=await currentUser(token);if(!user)return authResponse({},401);
 if(!['staff','admin'].includes(user.role)||await dbRpc('nhso_close_allowed',{},{token})!==true)return authResponse({},403);
 const b=await readBody(request,2048);let rpc,args;
 if(b.action==='stations'){rpc='nhso_agent_station_list';args={};}
 else if(b.action==='read'&&typeof b.personId==='string'&&b.personId.length<=100&&typeof b.station==='string'&&b.station.length<=100){rpc='nhso_agent_read_request';args={p_person:b.personId,p_station:b.station};}
 else if(['status','confirm'].includes(b.action)&&/^[0-9a-f-]{36}$/i.test(b.id||'')){
 if(b.action==='status'){rpc='nhso_agent_read_status';args={p_id:b.id};}
 else {if(b.confirm!==true||!['ปกติ','ผิดปกติ'].includes(b.result)||typeof b.vn!=='string'||b.vn.length>30)return authResponse({},400);rpc='nhso_agent_confirm';args={p_id:b.id,p_result:b.result,p_vn:b.vn,p_confirm:true};}
 }else return authResponse({},400);
 return authResponse(await dbRpc(rpc,args,{token}));
 }catch{return authResponse({error:'ดำเนินการไม่ได้ กรุณาตรวจสถานะเครื่อง ผลอ่านบัตร และรายการ FIT ก่อนลองใหม่'},409);}
}
