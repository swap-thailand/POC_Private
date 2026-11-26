// Local development database test for the JingTix migrations (never production).
// Runs a throwaway in-memory Postgres (PGlite), adds minimal stand-ins for Supabase's auth/storage
// schemas and roles, applies the baseline, seeds data the way the current production code would,
// applies the new migration, then checks the cap, the RPC, RLS and the Interested view.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const dir = process.argv[2] || new URL("../../supabase/migrations", import.meta.url).pathname;
const baseline = readFileSync(`${dir}/20261122000000_marketplace.sql`, 'utf8');
const next = readFileSync(`${dir}/20261126000000_resale_cap_and_interests.sql`, 'utf8');

const db = new PGlite(); // in-memory, discarded at exit
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
const throws = async (name, fn, re) => {
  try { await fn(); ok(name, false, '(expected an error)'); }
  catch (e) { ok(name, !re || re.test(e.message), re && !re.test(e.message) ? e.message : ''); }
};
const as = async (role, uid, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${role};`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
};

// ---- Supabase stand-ins (only what the migrations touch) ----
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

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const EV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', STRICT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', HIDDEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const uuid = n => `0000000${n}-0000-4000-8000-00000000000${n}`;

// ---- 1. Baseline (what production runs today) ----
await db.exec(baseline);
ok('baseline migration applies', true);
await db.exec(`
  insert into auth.users (id) values ('${A}'), ('${B}');
  insert into public.events (id, name, poster_title, starts_at, venue, city, face_value_thb, published) values
    ('${EV}', 'White Party', 'WP', now() + interval '30 days', 'Paragon', 'Bangkok', 3200, true),
    ('${STRICT}', 'S2O', 'S2O', now() + interval '60 days', 'TBA', 'Bangkok', 3000, true),
    ('${HIDDEN}', 'Draft', 'D', now() + interval '10 days', 'X', 'Bangkok', 500, false);
`);
// A listing created through the old RPC, at face value.
await db.query(`insert into storage.objects (bucket_id, name, owner_id) values ('marketplace-tickets', $1, $2)`, [`${A}/${uuid(1)}`, A]);
await as('authenticated', A, `select public.marketplace_submit_listing($1, $2, 3200)`, [uuid(1), EV]);
ok('old RPC: listing at face value saved before the migration', (await db.query(`select count(*)::int n from public.listings`)).rows[0].n === 1);

// ---- 2. New migration ----
await db.exec(next);
ok('new migration applies on top of the baseline', true);
await db.exec(next);
ok('new migration can be re-run safely', true);
ok('existing listing still valid', (await db.query(`select count(*)::int n from public.listings where price_thb = 3200`)).rows[0].n === 1);
await db.query(`update public.events set strict_face_value = true where id = $1`, [STRICT]);

// ---- 3. Price cap through the RPC (the path the app uses) ----
const submit = async (n, ev, price) => {
  await db.query(`insert into storage.objects (bucket_id, name, owner_id) values ('marketplace-tickets', $1, $2)`, [`${A}/${uuid(n)}`, A]);
  return as('authenticated', A, `select public.marketplace_submit_listing($1, $2, $3) id`, [uuid(n), ev, price]);
};
ok('RPC: 3,840 (120% of 3,200) accepted', (await submit(2, EV, 3840)).rows[0].id === uuid(2));
await throws('RPC: 3,841 (over 120%) rejected', () => submit(3, EV, 3841), /asking price is unavailable/);
ok('RPC: strict event 2,727 accepted (2,727 + 273 fee = 3,000 face)', (await submit(4, STRICT, 2727)).rows[0].id === uuid(4));
await throws('RPC: strict event 2,728 rejected (2,728 + 273 = 3,001)', () => submit(5, STRICT, 2728), /asking price is unavailable/);
await throws('RPC: unpublished event rejected', () => submit(6, HIDDEN, 100), /unavailable/);
await throws('RPC: anon cannot call it', () => as('anon', '', `select public.marketplace_submit_listing($1, $2, 100)`, [uuid(7), EV]), /permission denied/);

// ---- 4. Table check (defence in depth, even for service_role writes) ----
await throws('table check blocks a direct insert over 120%', () => db.query(
  `insert into public.listings (id, event_id, seller_id, price_thb, face_value_thb, ticket_path) values ($1, $2, $3, 3841, 3200, $4)`,
  [uuid(8), EV, A, `${A}/${uuid(8)}`]), /listings_price_cap/);
ok('old face-value check is gone', (await db.query(
  `select count(*)::int n from pg_constraint where conrelid = 'public.listings'::regclass and pg_get_constraintdef(oid) ilike '%price_thb <= face_value_thb%'`)).rows[0].n === 0);

// ---- 5. Interested ----
await as('authenticated', A, `insert into public.event_interests (event_id, user_id) values ($1, $2)`, [EV, A]);
await as('authenticated', B, `insert into public.event_interests (event_id, user_id) values ($1, $2)`, [EV, B]);
ok('fans can mark interest in a published event', true);
await throws('a fan cannot add interest for someone else', () => as('authenticated', A, `insert into public.event_interests (event_id, user_id) values ($1, $2)`, [STRICT, B]), /row-level security/);
await throws('no interest in unpublished events', () => as('authenticated', A, `insert into public.event_interests (event_id, user_id) values ($1, $2)`, [HIDDEN, A]), /row-level security/);
await throws('marking twice is refused (one per fan)', () => as('authenticated', A, `insert into public.event_interests (event_id, user_id) values ($1, $2)`, [EV, A]), /duplicate key/);
await throws('anon cannot mark interest', () => as('anon', '', `insert into public.event_interests (event_id, user_id) values ($1, $2)`, [EV, A]), /permission denied/);
const own = await as('authenticated', A, `select user_id from public.event_interests`);
ok('fans only see their own rows', own.rows.length === 1 && own.rows[0].user_id === A);
const counts = await as('anon', '', `select event_id, interested_count from public.marketplace_event_interest_counts`);
ok('anyone can read the total (2 interested)', counts.rows.length === 1 && counts.rows[0].interested_count === 2);
ok('the count view exposes no user ids', !Object.keys(counts.rows[0]).includes('user_id'));
await throws('anon cannot read the raw interest rows', () => as('anon', '', `select * from public.event_interests`), /permission denied/);
await as('authenticated', B, `delete from public.event_interests where event_id = $1 and user_id = $2`, [EV, A]); // B tries to remove A's
ok("a fan cannot remove someone else's interest", (await db.query(`select count(*)::int n from public.event_interests where user_id = $1`, [A])).rows[0].n === 1);
await as('authenticated', A, `delete from public.event_interests where event_id = $1 and user_id = $2`, [EV, A]);
ok('a fan can remove their own interest', (await as('anon', '', `select interested_count from public.marketplace_event_interest_counts`)).rows[0].interested_count === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
