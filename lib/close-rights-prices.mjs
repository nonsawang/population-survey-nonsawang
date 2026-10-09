// Local facility price confirmed by the operator; not an NHSO reimbursement rule.
export const closeRightsPrices = Object.freeze({
  FOBT: Object.freeze({ totalSatang: 6000, currency: 'THB', source: 'facility-confirmed' }),
});
export function closeRightsPrice(kpi) {
  return Object.hasOwn(closeRightsPrices,kpi) ? closeRightsPrices[kpi] : null;
}
