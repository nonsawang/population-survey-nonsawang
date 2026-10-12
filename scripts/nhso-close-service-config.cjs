// Trusted server/LAN configuration only; never accept this object from a request body.
function resolveCloseService(config, {hcode, zone, screeningType}) {
  if (!config || config.hcode !== hcode || config.zone !== zone ||
      !/^\d{5}$/.test(hcode) || !['test', 'production'].includes(zone)) {
    throw Error('CLOSE_SERVICE_SCOPE_REQUIRED');
  }
  const service = Object.hasOwn(config.services || {}, screeningType)
    ? config.services[screeningType] : null;
  if (!service || service.enabled !== true ||
      service.api !== 'nhso-claim-detail' ||
      typeof service.code !== 'string' || !service.code.trim() ||
      service.code.length > 20 || /\s/.test(service.code) ||
      typeof service.reference !== 'string' || !service.reference.trim() ||
      typeof service.verifiedBy !== 'string' || !service.verifiedBy.trim()) {
    throw Error('CLOSE_SERVICE_CONFIG_REQUIRED');
  }
  // No inference from FIT result, Authen lookup serviceCode, or e-Claim ADP.CODE.
  return service.code;
}
module.exports = {resolveCloseService};
