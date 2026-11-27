# Plug and play: from example events to real data

Written 2026-11-26 for Ori. This explains what the live site shows today and what has to happen for real data to replace it. No rebuild is needed for that switch.

## What the live site shows now

> **Update 2026-11-27:** the four starter events are published in production, so jingtix.com shows them
> and the example events are hidden (mode `'auto'`). Migration `20261126000000` is applied and
> `settings.dbFeatures` is on. Drop alerts have no table yet, so real events point fans to Instagram
> for drops instead of the alert form (`capabilities.waitlist = false` in the Supabase adapter).

The live site (jingtix.com, connected to Supabase) asks the database for upcoming published events. If it gets none back, it shows four **example events** instead: Clutch Fridays, White Party Bangkok, EDC Thailand and S2O Songkran. They come with their posters, ticket types, sample listings from sample sellers (Ploy K., Nat S. and others), service fees and Interested counts.

The examples are labelled everywhere: an "Example" badge on each poster, a dashed notice above the event list and on each event page, and a note in place of the Buy button. Buying, Interested, alerts and selling into an example event show "This is an example event" and never touch the database. Example ids start with `example-`, so they cannot collide with database uuids.

The code is in `src/services/showcase.js`. The sample data is `src/services/seed.js`, the same file the demo build uses.

## The switch

`settings.showcase.mode` in `src/config/settings.js` controls it:

| Mode | Behaviour |
|---|---|
| `'auto'` (current) | Examples show only while the database returns no upcoming published events. Publishing one real event hides every example on the next page load. |
| `'always'` | Examples show after the real events. Useful for a pitch while there are only a few real events. |
| `'off'` | Never show examples. |

With `'auto'`, going live is a database change only: publish an event and the site switches by itself.

## Getting the same events into the database

`supabase/seed/starter_events.sql` inserts the same four events into `public.events`, using the columns from the baseline migration. Points to know:

- Run it by hand in the SQL editor, on a dev or staging project first. It is not a migration.
- The rows go in **unpublished**, so the site keeps showing the examples until you publish.
- Re-running it is safe: a row that already exists (same poster title and start time) is skipped.
- Check each date, venue, face value and transfer rule with the organiser, then run the publish line at the bottom of the file.
- Clutch is weekly: add one row per Friday.
- S2O is face-value only. Set `strict_face_value` after migration `20261126000000` is applied (the line is in the file).

Poster art follows automatically. A database event whose `poster_title` or name contains WHITE PARTY, CLUTCH, EDC or S2O gets that poster. Any other event gets a generated gradient.

## How the screens map to your tables

The screens only ever call the functions in `BACKEND_CONTRACT.md` through `src/services/supabaseAdapter.js`. To connect a new table, change the adapter's query and mapping; the screens stay as they are.

| Screen field | Comes from today | Notes for new tables |
|---|---|---|
| Event name, poster title, subtitle, date, venue, city, artists | `events` columns | `mapEvent()` in the adapter |
| Transfer rules (EN/TH) | `events.transfer_en`, `transfer_th` | |
| Ticket types and face value | one per event from `events.face_value_thb` | Replace with a `ticket_types` table: map each row to `{ id, eventId, name: { en, th }, faceValue }` |
| Tickets available, "from ฿…" | `marketplace_available_listings` | Fill `minTotal` with price plus buyer fee (`src/lib/fees.js`) |
| Seller name, verified, swaps, rating | not in the schema yet (blank) | Map to `seller: { id, name, verified, swaps, rating }` once a public seller profile exists |
| Interested count and heart | `event_interests` and `marketplace_event_interest_counts` | Needs migration `20261126000000`, then `settings.dbFeatures.interests = true` |
| Up to 20% over face | `listings_price_cap` and `marketplace_submit_listing` | Needs migration `20261126000000`, then `settings.dbFeatures.resaleMarkup = true` |
| Alerts (waiting list), buying, payouts | `notConnected` | Each is one adapter function; signatures are in `BACKEND_CONTRACT.md` |

## Order of operations

1. Apply migration `20261126000000` using the backup-first steps in `docs/handoff-2026-11-26-supabase-migration.md`.
2. Load `starter_events.sql` into a dev or staging project and check the site against it.
3. Run it in production, check the rows with the organisers, then publish.
4. Flip `settings.dbFeatures` and release through the `jingtix-git-release` checklist.

Tests: `npm run test:db` runs `tests/db/showcase.db.mjs`, which checks the example fallback, that example actions never reach the database, and the starter SQL against the real schema.
