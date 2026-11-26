// Example events for the live site while the database has no upcoming events.
//
// Wraps the connected (Supabase) data service. When the database returns no upcoming published
// events, the site shows the sample events from seed.js (Clutch, White Party, EDC, S2O) with their
// posters, ticket listings, sample sellers and Interested counts, all labelled "Example".
// As soon as real events exist in the database they replace the examples automatically
// (settings.showcase.mode 'auto'). Nothing here reads from or writes to the database: buying,
// Interested and alerts on an example event show a "this is an example" message instead.
//
// Example ids start with "example-" so they can never collide with database ids (uuids).

import { settings } from '../config/settings.js';
import { buyerFee, sellerFee } from '../lib/fees.js';
import { seed } from './seed.js';
import { ServiceError } from './errors.js';

export const EXAMPLE_PREFIX = 'example-';
export const isExampleId = id => typeof id === 'string' && id.startsWith(EXAMPLE_PREFIX);

// One read-only snapshot of the sample data, rebuilt on each call so dated events stay current
// (Clutch always points at the coming Friday).
export function exampleCatalog(now = Date.now()) {
  const S = seed(now);
  const user = id => S.users.find(u => u.id === id);
  const typeOf = id => S.ticketTypes.find(tt => tt.id === id);
  const over = ev => now > new Date(ev.startsAt).getTime() + settings.hideEventAfterHours * 3600000;
  const exId = id => EXAMPLE_PREFIX + id;

  const listingView = l => {
    const tt = typeOf(l.ticketTypeId);
    const bFee = buyerFee(l.price), sFee = sellerFee(l.price);
    const u = user(l.sellerId);
    return {
      id: exId(l.id), eventId: exId(l.eventId), ticketTypeId: exId(tt.id), ticketType: { ...tt, id: exId(tt.id), eventId: exId(tt.eventId) },
      price: l.price, faceValue: tt.faceValue, buyerFee: bFee, sellerFee: sFee, total: l.price + bFee, payout: l.price - sFee,
      seller: { id: exId(u.id), name: u.name, verified: !!u.verified, swaps: u.swaps || 0, rating: u.rating ?? null },
      status: 'approved', sample: true,
    };
  };

  const events = S.events
    .filter(ev => ev.published && !over(ev))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(ev => {
      const listings = S.listings.filter(l => l.eventId === ev.id && l.status === 'approved').map(listingView);
      const event = {
        ...ev, id: exId(ev.id), posterKey: ev.id, sample: true,
        ticketTypes: S.ticketTypes.filter(tt => tt.eventId === ev.id).map(tt => ({ ...tt, id: exId(tt.id), eventId: exId(ev.id) })),
        liveCount: listings.length,
        minTotal: listings.length ? Math.min(...listings.map(l => l.total)) : null,
        waitlistCount: S.waitlist.filter(w => w.eventId === ev.id).length,
        interestEnabled: true,
        interestedCount: (ev.interestBase || 0) + S.interests.filter(i => i.eventId === ev.id).length,
        youInterested: false,
      };
      return { event, listings };
    });
  return events;
}

const sampleOnly = async () => { throw new ServiceError('sampleOnly'); };
const guard = (fn, pick) => async (...args) => (isExampleId(pick(...args)) ? sampleOnly() : fn(...args));

export function withShowcase(real, mode = settings.showcase?.mode || 'auto') {
  if (mode === 'off') return real;
  let showing = false; // true while example events are on screen

  async function listEvents() {
    const events = await real.listEvents();
    const examples = mode === 'always' || events.length === 0;
    showing = examples;
    return examples ? [...events, ...exampleCatalog().map(x => x.event)] : events;
  }

  async function getEvent(id) {
    if (!isExampleId(id)) return real.getEvent(id);
    const hit = exampleCatalog().find(x => x.event.id === id);
    return hit ? structuredClone(hit) : null;
  }

  return {
    ...real,
    showcase: { mode, get showing() { return showing; } },
    listEvents,
    getEvent,
    async trackView(id) { if (!isExampleId(id)) return real.trackView(id); },
    toggleInterest: guard(real.toggleInterest, id => id),
    joinWaitlist: guard(real.joinWaitlist, id => id),
    reserveListing: guard(real.reserveListing, id => id),
    submitListing: guard(real.submitListing, input => input?.eventId),
  };
}
