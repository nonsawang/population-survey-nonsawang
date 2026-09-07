export const RESIDENCY_TYPES = [
  { code: '0', label: 'มาอาศัยในเขตแต่ไม่อยู่ตามทะเบียนบ้าน เช่น คนเร่ร่อน' },
  { code: '1', label: 'มีชื่อในทะเบียนบ้าน และอยู่อาศัยจริง' },
  { code: '2', label: 'มีชื่อในทะเบียนบ้าน แต่ไม่ได้อยู่อาศัย' },
  { code: '3', label: 'ไม่มีชื่อในทะเบียนบ้าน แต่มาอยู่อาศัย' },
  { code: '4', label: 'บุคคลนอกเขต' },
];
export const DISCHARGE_TYPES = [
  { code: '9', label: 'ยังไม่จำหน่าย' },
  { code: '1', label: 'เสียชีวิต' },
  { code: '2', label: 'ย้าย' },
  { code: '3', label: 'สาบสูญ' },
];
const text = value => String(value ?? '').trim();

export function populationStatus(row) {
  const rawType = text(row.residency_type);
  if (Number(row.status_model_version) !== 1) {
    const legacyDischarge = rawType === '0', deceased = rawType === '4';
    return { residencyType: legacyDischarge || deceased ? '' : rawType, dischargeCode: legacyDischarge ? '' : deceased ? '1' : '9', legacyDischarge, deceased, active: !legacyDischarge && !deceased, needsReview: legacyDischarge || deceased, migrated: false };
  }
  const dischargeCode = text(row.person_discharge_id);
  const knownDischarge = DISCHARGE_TYPES.some(item => item.code === dischargeCode);
  const knownResidency = RESIDENCY_TYPES.some(item => item.code === rawType);
  return { residencyType: rawType, dischargeCode, legacyDischarge: dischargeCode === '' && text(row.legacy_residency_type) === '0', deceased: dischargeCode === '1', active: dischargeCode === '9', needsReview: !knownDischarge || !knownResidency, migrated: true };
}

export function inSurveyScope(row) {
  const state = populationStatus(row);
  return state.active && state.residencyType !== '4';
}

export function statusUpdate(residencyType, dischargeCode) {
  if (residencyType !== '' && !RESIDENCY_TYPES.some(item => item.code === residencyType)) throw new Error('ประเภทอยู่อาศัยไม่ถูกต้อง');
  if (!DISCHARGE_TYPES.some(item => item.code === dischargeCode)) throw new Error('กรุณาเลือกเหตุจำหน่ายตาม HOSxP');
  return { residency_type: residencyType || null, person_discharge_id: Number(dischargeCode), status_model_version: 1 };
}

// Export only a complete, explicitly mapped record. Death/date updates need
// a separate reviewed workflow in HOSxP, not an inferred date or boolean.
export function hosxpStatusPayload(row) {
  const state = populationStatus(row);
  if (!state.migrated || state.needsReview) throw new Error('ต้องตรวจประเภทอยู่อาศัยและเหตุจำหน่ายก่อนส่ง HOSxP');
  return { house_regist_type_id: Number(state.residencyType), person_discharge_id: Number(state.dischargeCode) };
}
