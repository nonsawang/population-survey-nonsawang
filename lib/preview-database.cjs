// Keep Preview traffic away from the production queue consumed by the LAN worker.
const PRODUCTION_PROJECT = 'gxidztlvqsppixlwrxeo';
const isReadOnly = (env = process.env) => env.APP_READ_ONLY === 'true';
const readRpc = new Set(['hosxp_registry_status','app_current_user','screening_search','screening_history_list','screening_overview','screening_review_list','hosxp_review_list','hosxp_fit_preview','hosxp_fit_import_status','authen_report_list','person_identity_search','person_identity_preview','person_identity_status']);
function dataAllowed(method, parts) {
  return parts.length === 1 ? ['GET','HEAD'].includes(method) :
    parts.length === 2 && parts[0] === 'rpc' && method === 'POST' && readRpc.has(parts[1]);
}
function assertPreviewDatabase(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return;
  const project = env.PREVIEW_SUPABASE_PROJECT_REF || '';
  const expected = `https://${project}.supabase.co`;
  if (isReadOnly(env) && project === PRODUCTION_PROJECT && env.NEXT_PUBLIC_SUPABASE_URL === expected) return;
  if (!/^[a-z]{20}$/.test(project) || project === PRODUCTION_PROJECT ||
      env.NEXT_PUBLIC_SUPABASE_URL !== expected) {
    throw new Error('PREVIEW_DATABASE_REQUIRED: configure a separate Supabase test project and PREVIEW_SUPABASE_PROJECT_REF');
  }
}
module.exports = { assertPreviewDatabase, isReadOnly, dataAllowed };
