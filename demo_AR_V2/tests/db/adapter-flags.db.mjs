// Proves the live-site (Supabase) adapter is safe to deploy before migration 20261126000000:
// with settings.dbFeatures off it never requests event_interests, the interest-count view or
// events.strict_face_value, and the Sell form falls back to face value. With them on, it does use them.
// Runs offline: fetch is stubbed and every request URL is recorded.
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url); calls.push(`${opts.method || 'GET'} ${decodeURIComponent(u)}`);
  const body = u.includes('/rest/v1/events') ? [{ id: 'e1', name: 'Test night', poster_title: 'T', subtitle: '', starts_at: '2099-01-01T20:00:00Z', venue: 'V', city: 'Bangkok', artists: [], transfer_en: '', transfer_th: '', face_value_thb: 1000, strict_face_value: false }]
    : u.includes('marketplace_event_interest_counts') ? [{ event_id: 'e1', interested_count: 7 }] : [];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
globalThis.__MARKETPLACE_CONFIG__ = { url: 'https://example-dev.supabase.co', key: 'sb_publishable_test' };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { origin: 'http://localhost', pathname: '/' };

const { settings } = await import('../../src/config/settings.js');
const { initApi } = await import('../../src/services/index.js');
const { maxListingPrice } = await import('../../src/lib/fees.js');
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const touched = re => calls.some(c => re.test(c));

// Switches off (what ships now)
ok('switches are off by default', settings.dbFeatures.interests === false && settings.dbFeatures.resaleMarkup === false);
const api = await initApi();
ok('live site uses the Supabase adapter', api.mode === 'connected');
const events = await api.listEvents();
const ev = await api.getEvent('e1');
ok('events still load', events.length === 1 && ev?.event?.id === 'e1');
ok('no request to event_interests', !touched(/event_interests/));
ok('no request to the interest-count view', !touched(/marketplace_event_interest_counts/));
ok('no request for events.strict_face_value', !touched(/strict_face_value/));
ok('Interested hidden on events', events[0].interestEnabled === false && ev.event.interestEnabled === false);
ok('Sell form capped at face value', settings.pricing.maxMarkup === 0 && maxListingPrice(1000, false) === 1000);
ok('advertised policy stays 20%', settings.pricing.policyMarkup === 0.2);
let threw = false; try { await api.toggleInterest('e1'); } catch { threw = true; }
ok('toggleInterest refuses while off', threw);

// Switches on (after Ori applies the migration)
calls.length = 0;
settings.dbFeatures.interests = true; settings.dbFeatures.resaleMarkup = true;
const on = await api.listEvents();
ok('with switches on: reads the interest-count view', touched(/marketplace_event_interest_counts/));
ok('with switches on: reads strict_face_value', touched(/strict_face_value/));
ok('with switches on: Interested shows the count', on[0].interestEnabled === true && on[0].interestedCount === 7);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
