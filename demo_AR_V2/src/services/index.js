// Picks the data service. Screens only ever import `api` from here.
// No Supabase keys → sample data in this browser. Keys set at build time → Supabase.

/* global __MARKETPLACE_CONFIG__ */
import { mockAdapter } from './mockAdapter.js';

const config = typeof __MARKETPLACE_CONFIG__ !== 'undefined' ? __MARKETPLACE_CONFIG__ : null;

export let api = mockAdapter;

export async function initApi() {
  if (config) {
    const { createSupabaseAdapter } = await import('./supabaseAdapter.js');
    api = createSupabaseAdapter(config);
  }
  return api;
}

export { ServiceError, errorKeys } from './errors.js';
