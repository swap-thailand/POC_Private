// Supabase implementation of the data service.
// Sign-in, event discovery and seller submission reuse the calls my co-founder built in
// demo_AR_V1/marketplace.js. Everything else throws ServiceError('notConnected') until the
// backend exists. See BACKEND_CONTRACT.md for what each function needs.

import { createClient } from '@supabase/supabase-js';
import { ServiceError } from './errors.js';
import { settings } from '../config/settings.js';

// Features that need migration 20261126000000 stay off until settings.dbFeatures turns them on.
const F = settings.dbFeatures || {};

const notConnected = async () => { throw new ServiceError('notConnected'); };

export function createSupabaseAdapter(config) {
  const client = createClient(config.url, config.key, { auth: { flowType: 'pkce' } });
  const listeners = new Set();
  let sessionUser = null;

  const data = result => {
    if (result.error) throw result.error;
    return result.data;
  };

  client.auth.onAuthStateChange((_event, session) => {
    sessionUser = session?.user ?? null;
    listeners.forEach(fn => fn());
  });

  // v1 schema has one face value per event, so each event becomes one ticket type here.
  // Swap this for a ticket_types table once it exists.
  function mapEvent(row, listings, interest = { counts: new Map(), mine: new Set() }) {
    const live = listings.filter(l => l.event_id === row.id);
    return {
      id: row.id, name: row.name, posterTitle: row.poster_title, subtitle: row.subtitle || '',
      startsAt: row.starts_at, venue: row.venue, city: row.city, artists: row.artists || [],
      transfer: { en: row.transfer_en || '', th: row.transfer_th || '' },
      strictFaceValue: F.resaleMarkup ? row.strict_face_value === true : false, published: true,
      interestEnabled: !!F.interests, interestedCount: interest.counts.get(row.id) || 0, youInterested: interest.mine.has(row.id),
      ticketTypes: [{ id: `${row.id}:default`, eventId: row.id, name: { en: 'Ticket', th: 'ตั๋ว' }, faceValue: row.face_value_thb }],
      liveCount: live.length,
      minTotal: null,
      waitlistCount: 0,
    };
  }

  // Interested totals (public view) plus the signed-in fan's own rows (RLS: own rows only).
  // Needs migration 20261126000000_resale_cap_and_interests.sql.
  async function interests() {
    if (!F.interests) return { counts: new Map(), mine: new Set() };
    const [counts, mine] = await Promise.all([
      client.from('marketplace_event_interest_counts').select('event_id,interested_count'),
      sessionUser ? client.from('event_interests').select('event_id') : Promise.resolve({ data: [] }),
    ]);
    return {
      counts: new Map(data(counts).map(r => [r.event_id, r.interested_count])),
      mine: new Set(data(mine).map(r => r.event_id)),
    };
  }

  async function discover() {
    const [events, listings] = await Promise.all([
      client.from('events')
        .select('id,name,poster_title,subtitle,starts_at,venue,city,artists,transfer_en,transfer_th,face_value_thb' + (F.resaleMarkup ? ',strict_face_value' : ''))
        .gt('starts_at', new Date().toISOString()).order('starts_at').order('id'),
      client.from('marketplace_available_listings').select('id,event_id,price_thb,face_value_thb').order('id'),
    ]);
    return { events: data(events), listings: data(listings) };
  }

  return {
    mode: 'connected',
    // waitlist: no table yet, so the site points fans to Instagram for drops instead of the alert form.
    capabilities: { checkout: false, admin: false, testTools: false, interests: !!F.interests, resaleMarkup: !!F.resaleMarkup, waitlist: false },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    tick() { return false; },
    timing() { return { holdMs: 10 * 60000, fastTimers: false }; },

    async currentUser() {
      if (!sessionUser) {
        const { data: s } = await client.auth.getSession();
        sessionUser = s?.session?.user ?? null;
      }
      return sessionUser ? { id: sessionUser.id, name: sessionUser.email, email: sessionUser.email, roles: ['buyer', 'seller'], banned: false } : null;
    },
    async signIn({ email, consent }) {
      if (!consent) throw new ServiceError('consent');
      data(await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }));
      return { pendingEmailLink: true };
    },
    async signOut() { data(await client.auth.signOut({ scope: 'local' })); },
    deleteAccount: notConnected,

    async listEvents() {
      const [{ events, listings }, interest] = await Promise.all([discover(), interests()]);
      return events.map(e => mapEvent(e, listings, interest));
    },
    async getEvent(id) {
      const [{ events, listings }, interest] = await Promise.all([discover(), interests()]);
      const row = events.find(e => e.id === id);
      if (!row) return null;
      const ev = mapEvent(row, listings, interest);
      return {
        event: ev,
        listings: listings.filter(l => l.event_id === id).map(l => ({
          id: l.id, eventId: id, ticketTypeId: ev.ticketTypes[0].id, ticketType: ev.ticketTypes[0], price: l.price_thb,
          faceValue: l.face_value_thb, buyerFee: 0, sellerFee: 0, total: l.price_thb, payout: l.price_thb,
          seller: { id: '', name: '', verified: true, swaps: 0, rating: null }, status: 'approved',
        })),
      };
    },
    async trackView() { /* analytics table not built yet */ },

    async toggleInterest(eventId) {
      if (!F.interests) throw new ServiceError('notConnected');
      const user = sessionUser;
      if (!user) throw new ServiceError('notSignedIn');
      const existing = data(await client.from('event_interests').select('event_id').eq('event_id', eventId).eq('user_id', user.id));
      if (existing.length) data(await client.from('event_interests').delete().eq('event_id', eventId).eq('user_id', user.id));
      else data(await client.from('event_interests').insert({ event_id: eventId, user_id: user.id }));
      const row = data(await client.from('marketplace_event_interest_counts').select('interested_count').eq('event_id', eventId));
      return { interested: !existing.length, count: row[0]?.interested_count || 0 };
    },

    async submitListing({ eventId, price, file, fileBlob }) {
      const user = sessionUser;
      if (!user) throw new ServiceError('notSignedIn');
      const id = crypto.randomUUID();
      const bucket = client.storage.from('marketplace-tickets');
      const path = `${user.id}/${id}`;
      const { error } = await bucket.upload(path, fileBlob, { contentType: file.type });
      if (error) {
        // The upload may have succeeded before its response was lost.
        const existing = await bucket.info(path);
        if (existing.error || !existing.data) throw error;
      }
      return data(await client.rpc('marketplace_submit_listing', { submission_id: id, selected_event: eventId, asking_price: Number(price) }));
    },
    async myListings() {
      const rows = data(await client.from('listings').select('id,event_id,price_thb,status,created_at').order('created_at', { ascending: false }));
      return rows.map(r => ({ id: r.id, eventId: r.event_id, price: r.price_thb, status: r.status, createdAt: r.created_at, order: null, event: null, ticketType: null }));
    },
    withdrawListing: notConnected,
    markTransferred: notConnected,

    reserveListing: notConnected,
    submitPaymentSlip: notConnected,
    payByCard: notConnected,
    cancelReservation: notConnected,
    myOrders: async () => [],
    confirmEntry: notConnected,
    reportProblem: notConnected,
    joinWaitlist: notConnected,

    submitPartnerLead: notConnected,

    adminData: notConnected,
    approveListing: notConnected,
    rejectListing: notConnected,
    setBanned: notConnected,
    getListingFile: notConnected,
    getSlip: notConnected,
    markPaymentReceived: notConnected,
    rejectPayment: notConnected,
    releasePayout: notConnected,
    refundOrder: notConnected,
    notifyWaitlist: notConnected,

    pilotData: notConnected,
    addFeedback: notConnected,
    exportData: notConnected,

    listUsers: async () => [],
    actAs: notConnected,
    addUser: notConnected,
    createOrderFor: notConnected,
    liveListingsForTest: async () => [],
    getTestSettings: async () => ({ skipApproval: false, fastTimers: false }),
    setTestSettings: notConnected,
    runTimers: async () => {},
    resetDemo: notConnected,
  };
}
