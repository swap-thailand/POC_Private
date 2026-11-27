# Handoff: production Supabase migration for the 26 Nov 2026 release

> **Status: done on 2026-11-27** (Ori approved). Backup recorded first; dry-run on production in a discarded
> transaction; applied as `resale_cap_and_interests` (migration history 20261127093547); verified; the four
> starter events published; `settings.dbFeatures` switched on in release `v2-2026-11-27`.
> One fix found by the production dry run: the RPC's variable `strict` is a reserved word in PL/pgSQL on
> production Postgres 17.12 (the local PGlite test accepted it), renamed `face_value_only`.
> Rollback: `supabase/rollback/20261126000000_down.sql` (rehearsed in `tests/db/rollback.db.mjs`).
> The steps below are kept for reference.

**For:** Ori (needs Supabase access to the production project)
**Release already live without it:** tag `v2-2026-11-26` (POC_Private), synced to POC_Demo. On jingtix.com the Interested button is hidden and the Sell form caps prices at face value until this is done.

## What this unlocks

- **120% resale cap.** Sellers can ask up to 20% over face value (TicketSwap-style pricing: buyer pays a 10% service fee, seller pays 5%).
- **Strict face-value events.** Organisers can flag an event so the buyer's total, fee included, stays at face value.
- **Interested.** Fans tap a heart on an event, and everyone sees "X interested" (like RA).

All three need migration `demo_AR_V2/supabase/migrations/20261126000000_resale_cap_and_interests.sql`.

## Prompt to paste into your coding agent (Claude Code or Codex), or follow by hand

```
You're finishing a JingTix release. Follow the JingTix git/release checklist (canonical repo
swap-thailand/POC_Private, public snapshot swap-thailand/POC_Demo, production = POC_Demo/main ->
Cloudflare "jingtix" -> jingtix.com -> production Supabase project ivesiuybipttiepgldcd).
Stop and report at the first failed or blocked step. Never print secrets.

1. Pull POC_Private main at tag v2-2026-11-26. In demo_AR_V2 run `npm ci` and `npm run test:db`
   (expect 24 + 13 passing).

2. Back up production BEFORE any schema change, and write down: the backup location or snapshot ID,
   the timestamp, and the current release commit (POC_Demo main). Use the dashboard backup
   (Database > Backups) if the plan has it; otherwise `supabase db dump` the schema and the data
   (roles, schema, data as separate files) and store them somewhere private, not in Git.

3. Check production matches the baseline before migrating. Production was built from
   supabase/migrations/20261122000000_marketplace.sql (same as demo_AR_V1). If anything differs,
   stop and tell Andrew.

4. Rehearse on a non-production database first (a Supabase branch or a dev project): apply the
   baseline, then 20261126000000_resale_cap_and_interests.sql, and confirm it runs cleanly.

5. Apply 20261126000000_resale_cap_and_interests.sql to production (SQL editor, run the whole
   file once; or with the CLI after marking 20261122000000 as already applied). It is backward
   compatible: the current live site keeps working.

6. Verify on production, saving the output of each query:
   select conname, pg_get_constraintdef(oid) from pg_constraint
     where conrelid = 'public.listings'::regclass and contype = 'c';
     -- expect listings_price_cap: CHECK ((price_thb * 5) <= (face_value_thb * 6)),
     -- and no "price_thb <= face_value_thb" check
   select column_name, data_type, column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'events' and column_name = 'strict_face_value';
     -- expect boolean, default false
   select prosrc ilike '%strict_face_value%' as updated from pg_proc
     where proname = 'marketplace_submit_listing';        -- expect true
   select relrowsecurity from pg_class where oid = 'public.event_interests'::regclass;  -- expect true
   select policyname, cmd, roles from pg_policies where tablename = 'event_interests';
     -- expect 3: select / insert / delete, all for authenticated
   select grantee, table_name, privilege_type from information_schema.role_table_grants
     where table_name in ('event_interests', 'marketplace_event_interest_counts')
     order by 1, 2, 3;
     -- expect: anon SELECT on the view only; authenticated SELECT on the view and
     -- SELECT/INSERT/DELETE on event_interests; service_role on event_interests
   Then open jingtix.com and check the homepage and the Sell page still load.

7. Turn the features on: in POC_Private, set demo_AR_V2/src/config/settings.js
   dbFeatures: { resaleMarkup: true, interests: true }. Run `npm run build:demo`,
   `npx playwright test` and `npm run test:db`, commit, tag (e.g. v2-2026-11-27), sync
   demo_AR_V2 to POC_Demo (keep POC_Demo's deployment config; no .env files or keys), push, and
   verify jingtix.com: hearts show on event cards, the Sell form allows up to 120% of face value,
   and there are no failed requests to event_interests or marketplace_event_interest_counts.

8. Production has no published events yet, so jingtix.com shows an empty list. Add real events
   (public.events with published = true, face_value_thb, and strict_face_value = true for any
   organiser that requires face value only). Agree the list with Andrew first.
```

## Rollback

- **Code:** revert POC_Demo main to the previous commit. Safe either way: the current code runs on the old schema (switches off) and on the new one.
- **Schema:** the migration only adds a column, a table, a view and policies, and loosens one check, so old code keeps working on it. To undo it: drop the view and `event_interests`, drop the `strict_face_value` column, restore the original `marketplace_submit_listing` from the baseline, and swap `listings_price_cap` back to `price_thb <= face_value_thb`. That last step fails if any listing is already priced above face value, so check first. Take a fresh backup before any rollback.

## Also worth a look

On GitHub, POC_Private is public and POC_Demo is private, which is the opposite of what the release checklist assumes. The checklist treats POC_Private as the place for private material like migrations and docs, so the two settings are probably swapped.
