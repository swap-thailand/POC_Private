// Picks the data service. Screens only ever import `api` from here.
// No Supabase keys → sample data in this browser. Keys set at build time → Supabase.

/* global __MARKETPLACE_CONFIG__ */
import { mockAdapter } from './mockAdapter.js';
import { withShowcase } from './showcase.js';
import { settings } from '../config/settings.js';

const config = typeof __MARKETPLACE_CONFIG__ !== 'undefined' ? __MARKETPLACE_CONFIG__ : null;

export let api = mockAdapter;

export async function initApi() {
  if (config) {
    const { createSupabaseAdapter } = await import('./supabaseAdapter.js');
    // Example events fill the site while the database has none (see showcase.js, settings.showcase).
    api = withShowcase(createSupabaseAdapter(config));
    // Until the resale-cap migration is live, the database only accepts face value: enforce the same here.
    if (!api.capabilities.resaleMarkup) settings.pricing.maxMarkup = 0;
  }
  return api;
}

export { ServiceError, errorKeys } from './errors.js';
