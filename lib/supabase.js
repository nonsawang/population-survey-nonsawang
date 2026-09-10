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
  const PARALLEL_PAGES = 4;
  let allRows = [];
  const fetchPage = async offset => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let query = supabase.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
      Object.entries(filters).forEach(([key, value]) => { query = query.filter(key, 'eq', value); });
      const result = await query;
      if (!result.error || ![408, 429, 500, 502, 503, 504].includes(Number(result.error.status))) return result;
      await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
    throw new Error(`โหลดข้อมูล ${table} ไม่สำเร็จหลังลองซ้ำ`);
  };
  for (let offset = 0; ; offset += PAGE_SIZE * PARALLEL_PAGES) {
    const pages = await Promise.all(Array.from({ length: PARALLEL_PAGES }, (_, index) => fetchPage(offset + index * PAGE_SIZE)));
    let complete = false;
    for (const result of pages) {
      if (result.error) throw result.error;
      const data = result.data || [];
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) { complete = true; break; }
    }
    if (complete) break;
  }
  return allRows;
}
