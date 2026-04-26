import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gxidztlvqsppixlwrxeo.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
