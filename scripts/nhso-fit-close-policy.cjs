// Input must come from a trusted server/LAN snapshot, never from browser assertions.
function verifyFitCloseSnapshot(snapshot){
 if(!snapshot||!['staff','admin'].includes(snapshot.actor?.role))throw Error('STAFF_REQUIRED');
 const {screening,visit,approval}=snapshot;
 if(screening?.type!=='FOBT'||!screening.id||!screening.savedAt||!['ปกติ','ผิดปกติ'].includes(screening.result))throw Error('SAVED_FIT_RESULT_REQUIRED');
 if(!visit?.vn||!visit.cid||visit.cid!==screening.cid||!screening.personId)throw Error('VISIT_IDENTITY_MISMATCH');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(screening.date)||screening.date!==visit.date)throw Error('VISIT_DATE_MISMATCH');
 if(visit.totalSatang!==6000)throw Error('FIT_AMOUNT_MISMATCH');
 if(!visit.mainInsclCode||visit.mainInsclCode==='PP')throw Error('ACTUAL_ENTITLEMENT_REQUIRED');
 if(!visit.claimServiceCode||visit.serviceMappingVerified!==true)throw Error('SERVICE_MAPPING_REQUIRED');
 if(!Number.isSafeInteger(visit.paidSatang)||!Number.isSafeInteger(visit.privilegeSatang)||visit.paidSatang<0||visit.privilegeSatang<0||visit.paidSatang+visit.privilegeSatang!==6000)throw Error('AMOUNT_SPLIT_REQUIRED');
 if(!approval||approval.actorId!==snapshot.actor.id||!snapshot.actor.id||approval.screeningId!==screening.id||approval.vn!==visit.vn||approval.cid!==visit.cid||approval.revision!==screening.revision||!screening.revision||approval.action!=='manual-close')throw Error('MANUAL_APPROVAL_REQUIRED');
 return {serviceGroup:'PP',mainInsclCode:visit.mainInsclCode,totalAmount:60,paidAmount:visit.paidSatang/100,privilegeAmount:visit.privilegeSatang/100};
}
function nextCloseAction({closeState,hosxpState}){
 if(closeState==='confirmed')return hosxpState==='written'?'complete':'write_hosxp_only';
 if(['reserved','outcome_unknown'].includes(closeState))return 'reconcile_without_resending';
 return 'review_required';
}
module.exports={verifyFitCloseSnapshot,nextCloseAction};
