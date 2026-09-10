import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gxidztlvqsppixlwrxeo.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.origin !== new URL(SUPABASE_URL).origin || !url.pathname.startsWith('/rest/v1/')) throw new Error('Unsupported data endpoint');
    const headers = new Headers(options.headers);
    headers.delete('apikey'); headers.delete('authorization'); headers.delete('x-app-session');
    const response = await fetch(`/api/data/${url.pathname.slice('/rest/v1/'.length)}${url.search}`, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('population-session-expired'));
    return response;
  } },
});

// ─── Helper: selectAll with pagination ───
export async function selectAll(table, columns = '*', filters = {}) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
    Object.entries(filters).forEach(([key, value]) => {
      query = query.filter(key, 'eq', value);
    });
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allRows;
}
