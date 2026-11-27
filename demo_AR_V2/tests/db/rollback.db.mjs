// Rehearsal of the production change on a throwaway local database (never production):
// baseline -> migration -> rollback must return the schema exactly to the baseline, and the
// migration must apply again cleanly afterwards. Also loads and publishes the starter events.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const root = new URL('../../supabase/', import.meta.url).pathname;
const read = p => readFileSync(root + p, 'utf8');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage, public to anon, authenticated, service_role;
`);

// Everything about the public schema that matters, as one comparable string.
const snapshot = async () => JSON.stringify((await db.query(`select jsonb_build_object(
  'cols', (select jsonb_agg(table_name||'.'||column_name||':'||data_type||':'||coalesce(column_default,'') order by 1) from information_schema.columns where table_schema='public'),
  'cons', (select jsonb_agg(conrelid::regclass::text||'|'||pg_get_constraintdef(oid) order by 1) from pg_constraint where connamespace='public'::regnamespace),
  'funcs', (select jsonb_agg(md5(pg_get_functiondef(p.oid)) order by 1) from pg_proc p where p.pronamespace='public'::regnamespace),
  'acl', (select jsonb_agg(p.proname||':'||coalesce(p.proacl::text,'') order by 1) from pg_proc p where p.pronamespace='public'::regnamespace),
  'views', (select coalesce(jsonb_agg(viewname order by 1), '[]') from pg_views where schemaname='public'),
  'pols', (select coalesce(jsonb_agg(tablename||'|'||policyname order by 1), '[]') from pg_policies where schemaname='public'),
  'grants', (select jsonb_agg(table_name||'|'||grantee||'|'||privilege_type order by 1) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role'))
) s`)).rows[0].s, (k, v) => Array.isArray(v) ? [...v].sort() : v);

await db.exec(read('migrations/20261122000000_marketplace.sql'));
await db.exec(`insert into auth.users (id) values ('11111111-1111-4111-8111-111111111111')`);
const base = await snapshot();
const diff = (a, b) => { const A = JSON.parse(a), B = JSON.parse(b); const out = []; for (const k of Object.keys(A)) { const x = new Set(A[k] || []), y = new Set(B[k] || []); for (const v of x) if (!y.has(v)) out.push('-' + k + ' ' + v); for (const v of y) if (!x.has(v)) out.push('+' + k + ' ' + v); } return out.join('\n'); };
ok('baseline applied', !!base);

await db.exec(read('migrations/20261126000000_resale_cap_and_interests.sql'));
const up = await snapshot();
ok('migration changes the schema', up !== base);

await db.exec(read('rollback/20261126000000_down.sql'));
const after = await snapshot();
ok('rollback returns the schema exactly to the baseline', after === base, diff(base, after));

await db.exec(read('migrations/20261126000000_resale_cap_and_interests.sql'));
ok('migration applies again cleanly after a rollback', (await snapshot()) === up);
await db.exec(read('migrations/20261126000000_resale_cap_and_interests.sql'));
const twice = await snapshot();
ok('migration is safe to run twice', twice === up, diff(up, twice));

// Starter events, then publish all four and mark S2O face-value only (what goes to production).
await db.exec(read('seed/starter_events.sql'));
await db.exec(`update public.events set strict_face_value = true where poster_title = 'S2O';
  update public.events set published = true where poster_title in ('WHITE PARTY', 'CLUTCH', 'EDC', 'S2O');`);
await db.exec(`set role anon;`);
const seen = (await db.query(`select poster_title from public.events order by starts_at`)).rows.map(r => r.poster_title).join(',');
await db.exec(`reset role;`);
ok('visitors see the four published events', seen === 'CLUTCH,EDC,WHITE PARTY,S2O', seen);

// Rolling back with a listing above face value is refused before anything changes.
await db.exec(`insert into public.listings (id, event_id, seller_id, price_thb, face_value_thb, ticket_path)
  select '22222222-2222-4222-8222-222222222222', id, '11111111-1111-4111-8111-111111111111', 3800, 3200,
  '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222' from public.events where poster_title='WHITE PARTY'`);
let refused = false; try { await db.exec(read('rollback/20261126000000_down.sql')); } catch (e) { refused = /above face value/.test(e.message); await db.exec('rollback'); }
ok('rollback refuses while a listing is above face value, and changes nothing', refused && (await snapshot()) === up);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
