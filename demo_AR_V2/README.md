# Ticket swap demo, v2 (front end)

The v2 demo builds out the buyer, seller and admin flows on top of the v1 Lineup design. All data goes through one data service (`src/services`). It runs on sample data in the browser until the Supabase backend is ready, so every screen can be clicked through today without a server.

v1 (`demo_AR_V1/`) is untouched.

## Run it

```bash
cd demo_AR_V2
npm install
npm run dev          # test mode on, sample data
npm run build:demo   # static build with test mode on (for sharing a demo link)
npm run build        # production build: test mode off, needs Supabase keys
npm run test:e2e     # Playwright, desktop + mobile
```

To run the tests with a system Chrome instead of Playwright's bundled browser, set `CHROME_PATH=/path/to/chrome`.

## What's in it

| Area | Where |
| --- | --- |
| Live listings from the data layer, search, event pages | `views/home.js`, `views/event.js` |
| Ticket types per event; sellers can list up to 20% over face value with TicketSwap-style fees (buyer 10%, seller 5%); strict face-value events | `services/seed.js`, `lib/fees.js`, `config/settings.js` (`pricing`) |
| Partner page dashboard: swaps over time, seller pricing, willingness to pay, buyer channels, fee breakdown (sample data) | `views/partners.js`, `views/charts.js` |
| Header logo: animated ticket mark, `orbit` or `ring` style | `lib/logo.js`, `config/brand.js` (`logo`) |
| Orders with a 10-minute hold and a status timeline | `views/tickets.js` |
| Manual PromptPay: sample QR, slip upload, admin "payment received" | `views/tickets.js`, `views/admin.js` |
| Card / Apple Pay alternative: sample hosted checkout, paid instantly with no slip check, simulated decline in test mode | `views/tickets.js` (`checkoutModal`), `settings.payments` |
| Review desk: approve/reject listings, ban sellers, view ticket files and slips, audit log | `views/admin.js` |
| Confirm entry, report a problem, auto-confirm after the confirm window | `views/tickets.js`, `services/mockAdapter.js` (`sweep`) |
| Waitlist ("Alert me") and simulated notify | `views/event.js`, admin Waitlist tab |
| Pilot & data: funnel, activity log, feedback log, JSON export | `views/tools.js` (`pilotView`) |
| PDPA basics: consent on sign-in and waitlist, privacy page, delete account | `views/tools.js` |
| Test tools: act as any user, add users, create orders for buyers, skip approval, fast timers, reset | `views/tools.js` (`testView`) |
| Partner with us page for venues and promoters, with an enquiry form that lands in the review desk | `views/partners.js`, admin Partners tab |

## Test mode

Test mode is on for `npm run dev` and `npm run build:demo`, and off for `npm run build`. Set `DEMO_TEST_MODE=0` or `1` to override. When it's on you get a yellow bar at the bottom of every page to switch users, plus the Test tools page. When it's off:

- the test bar, Test tools page and reset link are gone
- every test helper (`actAs`, `addUser`, `createOrderFor`, `listUsers`, `setTestSettings`, `runTimers`, `resetDemo` and the rest) refuses to run
- sample sign-in can never grant the admin role

Seeded users: Team Admin (admin), You (test buyer), sellers Ploy, Nat, Mike, Fah, Aom and Joy (unverified), buyers Sam and Mint.

Timers: holds last 10 minutes. The confirm window closes 4 hours after the event starts or 2 hours after the seller transfers, whichever is later, so nothing auto-confirms before the event and a late swap at the door still gets time. Events drop off the site 12 hours after they start. Clutch Fridays is a weekly sample event that always points at the coming Friday. With fast timers on, holds last 60 seconds and the confirm window closes 45 seconds after the seller marks the ticket transferred.

## Changing the name

Nothing in the code or copy hardcodes the brand. Edit `src/config/brand.js` (name, tagline, headline, hashtag, LINE handle, support email, storage slug). Fees, payment methods (PromptPay, card / Apple Pay, optional card surcharge), hold time and the confirm window live in `src/config/settings.js`.

Thai copy in `src/i18n/th.js` needs a native-speaker review before anyone outside the team sees it.

## Connecting the backend

Put `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`). The build checks the key is a publishable/anon key and refuses a service-role key. `npm run build` fails without keys rather than quietly shipping sample data (set `DEMO_ALLOW_SAMPLE=1` to override on purpose). With keys set, `src/services/supabaseAdapter.js` is used instead of the sample data. Today it handles sign-in, events and seller submission (the same calls as v1). Every other function returns a "not connected yet" message. See [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md) for what each one needs.

## Example events on the live site

While the connected database has no upcoming published events, the live site shows the sample events from `src/services/seed.js`, labelled "Example" (`src/services/showcase.js`, switch: `settings.showcase.mode`). Publishing one real event replaces them automatically. Starter SQL for the same events: `supabase/seed/starter_events.sql`. Full notes: `docs/plug-and-play-live-data.md`.

## Database migrations

Migrations live in `supabase/migrations/` and are applied in filename order:

- `20261122000000_marketplace.sql`: baseline, the schema production runs today (copied unchanged from `demo_AR_V1`).
- `20261126000000_resale_cap_and_interests.sql`: 120% resale cap, strict face-value events, Interested (`event_interests` and `marketplace_event_interest_counts`). Backward compatible with the previous app code.

`npm run test:db` applies both to a throwaway local Postgres (PGlite, never production) and checks the cap, the submit function, RLS and the Interested view. Apply migrations to production before deploying code that depends on them, after taking a backup.
