// Example events on the live site (src/services/showcase.js) and the starter-events SQL.
// Offline: fetch is stubbed for the adapter checks, and the SQL runs in a throwaway PGlite database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

// ---------- 1. Adapter: examples fill an empty database, real events replace them ----------
let realEvents = [];
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)); calls.push(`${opts.method || 'GET'} ${u}`);
  const body = u.includes('/rest/v1/events') ? realEvents : [];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
globalThis.__MARKETPLACE_CONFIG__ = { url: 'https://example-dev.supabase.co', key: 'sb_publishable_test' };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { origin: 'http://localhost', pathname: '/' };

const { initApi } = await import('../../src/services/index.js');
const { posterKey } = await import('../../src/views/components.js').catch(() => ({}));
const api = await initApi();

let events = await api.listEvents();
ok('empty database: four example events shown', events.length === 4 && events.every(e => e.sample));
ok('example ids cannot collide with database ids', events.every(e => e.id.startsWith('example-')));
const names = events.map(e => e.name);
ok('Clutch, White Party, EDC and S2O are there', ['Clutch Fridays', 'White Party Bangkok', 'EDC Thailand', 'S2O Songkran'].every(n => names.includes(n)));
const wp = events.find(e => e.posterKey === 'wp');
ok('White Party keeps its poster art, listings and Interested count', wp && wp.liveCount === 3 && wp.interestedCount === 1241 && wp.interestEnabled);
const detail = await api.getEvent(wp.id);
ok('example event page has listings with sellers and fees', detail.listings.length === 3 && detail.listings.every(l => l.seller.name && l.total === l.price + l.buyerFee));
ok('flagged as showing examples', api.showcase.showing === true);

calls.length = 0;
const refused = async fn => { try { await fn(); return false; } catch (e) { return e.code === 'sampleOnly'; } };
ok('Interested on an example is refused', await refused(() => api.toggleInterest(wp.id)));
ok('buying an example listing is refused', await refused(() => api.reserveListing(detail.listings[0].id)));
ok('alerts on an example are refused', await refused(() => api.joinWaitlist(wp.id, {})));
ok('selling into an example is refused', await refused(() => api.submitListing({ eventId: wp.id })));
ok('no database calls for example actions', calls.length === 0, calls.join(' | '));

realEvents = [{ id: 'e1', name: 'White Party Bangkok', poster_title: 'WHITE PARTY', subtitle: '', starts_at: '2099-01-01T20:00:00Z', venue: 'V', city: 'Bangkok', artists: [], transfer_en: '', transfer_th: '', face_value_thb: 3200 }];
events = await api.listEvents();
ok('one real event published: examples disappear', events.length === 1 && !events[0].sample && api.showcase.showing === false);
if (posterKey) ok('real event titled WHITE PARTY gets the White Party poster', posterKey(events[0]) === 'wp');

// ---------- 2. Starter-events SQL against the real schema ----------
const dir = new URL('../../supabase/', import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage, public to anon, authenticated, service_role;
`);
await db.exec(readFileSync(`${dir}migrations/20261122000000_marketplace.sql`, 'utf8'));
const seedSql = readFileSync(`${dir}seed/starter_events.sql`, 'utf8');
await db.exec(seedSql);
const count = async () => (await db.query(`select count(*)::int n, count(*) filter (where published)::int p from public.events`)).rows[0];
let c = await count();
ok('starter SQL adds four events, all unpublished', c.n === 4 && c.p === 0);
await db.exec(seedSql);
ok('re-running the starter SQL adds nothing', (await count()).n === 4);
await db.exec(`set role anon;`);
const visible = (await db.query(`select count(*)::int n from public.events`)).rows[0].n;
await db.exec(`reset role;`);
ok('visitors see none of them until published (site keeps showing examples)', visible === 0);
await db.exec(`update public.events set published = true where poster_title in ('WHITE PARTY', 'CLUTCH', 'EDC');`);
await db.exec(`set role anon;`);
const after = (await db.query(`select poster_title from public.events order by starts_at`)).rows.map(r => r.poster_title);
await db.exec(`reset role;`);
ok('after the publish line, visitors see the three checked events', after.join(',') === 'CLUTCH,EDC,WHITE PARTY', after.join(','));
await db.exec(readFileSync(`${dir}migrations/20261126000000_resale_cap_and_interests.sql`, 'utf8'));
await db.exec(`update public.events set strict_face_value = true where poster_title = 'S2O';`);
ok('S2O face-value line works after the new migration', (await db.query(`select strict_face_value s from public.events where poster_title='S2O'`)).rows[0].s === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
