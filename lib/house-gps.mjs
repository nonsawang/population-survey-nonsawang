export async function queueHouseGps({supabase,swal,moo,house,coords}) {
 const {latitude,longitude,accuracy}=coords;
 if(![latitude,longitude,accuracy].every(Number.isFinite)||accuracy<0||accuracy>100)throw Error('GPS_ACCURACY');
 const result=await swal({icon:'question',title:'ยืนยันพิกัดบ้าน',text:`หมู่ ${moo} บ้านเลขที่ ${house} — ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (คลาดเคลื่อนประมาณ ${Math.round(accuracy)} เมตร) บันทึกบนเว็บและเข้าคิว HOSxP?`,showCancelButton:true,confirmButtonText:'ยืนยันบันทึก',cancelButtonText:'ยกเลิก'});
 if(!result?.isConfirmed)return;
 const {error}=await supabase.rpc('house_gps_request',{p_id:crypto.randomUUID(),p_moo:String(moo),p_house:house.trim(),p_lat:latitude,p_lng:longitude,p_accuracy:accuracy});
 if(error)throw error;
 await swal({icon:'success',title:'บันทึกพิกัดบนเว็บแล้ว',text:'รอส่ง HOSxP — ยังไม่ใช่หลักฐานว่าเขียนเข้า HOSxP แล้ว'});
 return true;
}
