// Sample-data implementation of the data service.
// Everything lives in this browser's localStorage. Every function returns a Promise,
// so screens use it exactly like the Supabase adapter. See BACKEND_CONTRACT.md.

import { brand } from '../config/brand.js';
import { settings, TEST_MODE } from '../config/settings.js';
import { quote, cardSurcharge } from '../lib/fees.js';
import { uid } from '../lib/format.js';
import { seed, nextFriday22 } from './seed.js';
import { ServiceError } from './errors.js';

const KEY = `${brand.slug}-demo-v2`;
const ACTIVE = ['reserved', 'payment_submitted', 'paid', 'transferred', 'disputed', 'confirmed'];
const listeners = new Set();

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.version === 3) return parsed;
  } catch { /* storage unavailable or corrupt */ }
  return seed();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked: keep in memory */ }
  listeners.forEach(fn => fn());
}
const ok = value => Promise.resolve(structuredClone(value));
const nowIso = () => new Date().toISOString();

// ---------- helpers ----------
const user = id => S.users.find(u => u.id === id);
const me = () => (S.currentUserId ? user(S.currentUserId) : null);
const event = id => S.events.find(e => e.id === id);
const type = id => S.ticketTypes.find(tt => tt.id === id);
const listing = id => S.listings.find(l => l.id === id);
const order = id => S.orders.find(o => o.id === id);
const activeOrderFor = listingId => S.orders.find(o => o.listingId === listingId && ACTIVE.includes(o.status));
const isAdmin = u => !!u && u.roles.includes('admin');

function requireUser() {
  const u = me();
  if (!u) throw new ServiceError('notSignedIn');
  return u;
}
function requireAdmin() {
  const u = requireUser();
  if (!isAdmin(u)) throw new ServiceError('forbidden');
  return u;
}
function audit(action, target, detail = '') {
  S.audit.unshift({ id: uid('a'), at: nowIso(), actorId: S.currentUserId || 'system', action, target, detail });
}
function track(type, detail = '') {
  S.activity.unshift({ at: nowIso(), type, detail, userId: S.currentUserId || null });
  if (S.activity.length > 500) S.activity.length = 500;
}
function setStatus(o, status, by = S.currentUserId || 'system') {
  o.status = status;
  o.history.push({ status, at: nowIso(), by });
}
function validFile(file) {
  return file && settings.upload.types.includes(file.type) && file.size > 0 && file.size <= settings.upload.maxBytes;
}

// ---------- timers ----------
function holdMs() {
  return TEST_MODE && S.testSettings.fastTimers ? settings.test.fastHoldSeconds * 1000 : settings.holdMinutes * 60000;
}
export function confirmDeadline(o) {
  const ev = event(listing(o.listingId).eventId);
  if (TEST_MODE && S.testSettings.fastTimers && o.transferredAt) {
    return new Date(o.transferredAt).getTime() + settings.test.fastConfirmSeconds * 1000;
  }
  // Never before the event has started, and never less than a minimum window after
  // the transfer, so a last-minute swap at the door still gets time to confirm.
  const afterEvent = new Date(ev.startsAt).getTime() + settings.confirmWindowHours * 3600000;
  const afterTransfer = o.transferredAt ? new Date(o.transferredAt).getTime() + settings.minConfirmAfterTransferHours * 3600000 : 0;
  return Math.max(afterEvent, afterTransfer);
}
const eventOver = ev => Date.now() > new Date(ev.startsAt).getTime() + settings.hideEventAfterHours * 3600000;
function requireTestMode() {
  if (!TEST_MODE) throw new ServiceError('forbidden');
}
function sweep() {
  const now = Date.now();
  let changed = false;
  // Weekly club nights roll forward so the demo never shows last week's party.
  for (const ev of S.events) {
    if (ev.weekly && eventOver(ev)) { ev.startsAt = nextFriday22(now); changed = true; }
  }
  for (const o of S.orders) {
    if (o.status === 'reserved' && new Date(o.reservedUntil).getTime() <= now) {
      setStatus(o, 'expired', 'system');
      const l = listing(o.listingId);
      if (l && l.status === 'reserved') l.status = 'approved';
      track('act_expire', o.id);
      changed = true;
    }
    if (o.status === 'transferred' && confirmDeadline(o) <= now) {
      setStatus(o, 'confirmed', 'system');
      o.confirmedAt = nowIso();
      track('act_autoconfirm', o.id);
      audit('auto_confirm', o.id);
      changed = true;
    }
  }
  if (changed) save();
  return changed;
}

// ---------- shaping data for screens ----------
function sellerSummary(u) {
  return { id: u.id, name: u.name, verified: !!u.verified, swaps: u.swaps || 0, rating: u.rating ?? null };
}
function liveListings(eventId) {
  return S.listings.filter(l => l.eventId === eventId && l.status === 'approved' && !user(l.sellerId)?.banned);
}
function listingView(l) {
  const tt = type(l.ticketTypeId), ev = event(l.eventId);
  const q = quote(l.price, tt.faceValue, ev.strictFaceValue);
  return { ...l, ticketType: tt, faceValue: tt.faceValue, buyerFee: q.buyerFee, sellerFee: q.sellerFee, total: q.total, payout: q.payout, seller: sellerSummary(user(l.sellerId)) };
}
function eventView(ev) {
  const live = liveListings(ev.id).map(listingView);
  return {
    ...ev,
    ticketTypes: S.ticketTypes.filter(tt => tt.eventId === ev.id),
    liveCount: live.length,
    minTotal: live.length ? Math.min(...live.map(l => l.total)) : null,
    waitlistCount: S.waitlist.filter(w => w.eventId === ev.id).length,
  };
}
function orderView(o) {
  const l = listing(o.listingId), ev = event(l.eventId);
  return {
    ...o,
    event: ev, ticketType: type(l.ticketTypeId), listing: { id: l.id, status: l.status },
    buyer: { id: o.buyerId, name: user(o.buyerId)?.name || '—' },
    seller: { id: l.sellerId, name: user(l.sellerId)?.name || '—' },
    confirmDeadline: new Date(confirmDeadline(o)).toISOString(),
    eventStarted: Date.now() >= new Date(ev.startsAt).getTime(),
  };
}

// ---------- the data service ----------
export const mockAdapter = {
  mode: 'sample',
  capabilities: { checkout: true, admin: true, testTools: TEST_MODE },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  tick() { return sweep(); },
  timing() { return { holdMs: holdMs(), fastTimers: TEST_MODE && S.testSettings.fastTimers }; },

  // Session
  async currentUser() { sweep(); return me() ? structuredClone(me()) : null; },
  async signIn({ name, email, lineId = '', consent }) {
    if (!consent) throw new ServiceError('consent');
    const clean = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new ServiceError('invalid');
    let u = S.users.find(x => x.email === clean);
    if (!u) {
      u = { id: uid('u'), name: String(name || clean.split('@')[0]).trim(), email: clean, roles: ['buyer', 'seller'], banned: false, verified: false, lineId, consentAt: nowIso() };
      S.users.push(u);
      track('act_signup', u.id);
    }
    // Outside test mode, sample sign-in can never grant admin.
    if (!TEST_MODE && isAdmin(u)) throw new ServiceError('forbidden');
    S.currentUserId = u.id;
    save();
    return ok(u);
  },
  async signOut() { S.currentUserId = null; save(); },
  async deleteAccount() {
    const u = requireUser();
    S.listings.filter(l => l.sellerId === u.id && ['pending', 'approved'].includes(l.status)).forEach(l => { l.status = 'withdrawn'; });
    S.waitlist = S.waitlist.filter(w => w.userId !== u.id);
    // Orders stay for records, without the person's name.
    S.users = S.users.map(x => (x.id === u.id ? { ...x, name: 'Deleted user', email: '', lineId: '', deleted: true, roles: [] } : x));
    track('act_delete', '');
    audit('delete_account', u.id);
    S.currentUserId = null;
    save();
  },

  // Catalog
  async listEvents() {
    sweep();
    return ok(S.events.filter(e => e.published && !eventOver(e)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(eventView));
  },
  async getEvent(id) {
    sweep();
    const ev = event(id);
    if (!ev || !ev.published) return null;
    return ok({ event: eventView(ev), listings: eventOver(ev) ? [] : liveListings(id).map(listingView) });
  },
  async trackView(eventId) { track('act_view', eventId); save(); },

  // Seller
  async submitListing({ eventId, ticketTypeId, price, file }) {
    const u = requireUser();
    if (u.banned) throw new ServiceError('banned');
    const tt = type(ticketTypeId), ev = event(eventId);
    if (!tt || !ev || tt.eventId !== ev.id || eventOver(ev)) throw new ServiceError('invalid');
    if (!validFile(file)) throw new ServiceError('fileError');
    const q = quote(Number(price), tt.faceValue, ev.strictFaceValue);
    if (!Number.isInteger(Number(price)) || Number(price) <= 0) throw new ServiceError('priceInvalid');
    if (!q.ok) throw new ServiceError('priceTooHigh');
    const skip = TEST_MODE && S.testSettings.skipApproval;
    const l = { id: uid('l'), eventId, ticketTypeId, sellerId: u.id, price: Number(price), status: skip ? 'approved' : 'pending', file, rejectReason: '', createdAt: nowIso() };
    S.listings.unshift(l);
    track('act_listing', `${ev.name} · ${tt.name.en}`);
    if (skip) audit('auto_approve_test_mode', l.id, 'Skipped review (test mode)');
    save();
    return ok(listingView(l));
  },
  async myListings() {
    sweep();
    const u = requireUser();
    return ok(S.listings.filter(l => l.sellerId === u.id).map(l => {
      const o = S.orders.filter(x => x.listingId === l.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return { ...listingView(l), event: event(l.eventId), order: o ? orderView(o) : null };
    }));
  },
  async withdrawListing(id) {
    const u = requireUser();
    const l = listing(id);
    if (!l || l.sellerId !== u.id || !['pending', 'approved'].includes(l.status)) throw new ServiceError('invalid');
    l.status = 'withdrawn';
    track('act_withdraw', id);
    save();
  },
  async markTransferred(orderId) {
    const u = requireUser();
    const o = order(orderId);
    if (!o || listing(o.listingId).sellerId !== u.id || o.status !== 'paid') throw new ServiceError('invalid');
    o.transferredAt = nowIso();
    setStatus(o, 'transferred');
    track('act_transfer', orderId);
    save();
  },

  // Buyer
  async reserveListing(listingId, buyerId = null) {
    const u = buyerId ? user(buyerId) : requireUser();
    const l = listing(listingId);
    if (!u) throw new ServiceError('invalid');
    if (u.banned) throw new ServiceError('banned');
    if (!l || l.status !== 'approved' || activeOrderFor(listingId) || eventOver(event(l.eventId))) throw new ServiceError('unavailable');
    if (l.sellerId === u.id) throw new ServiceError('invalid');
    const v = listingView(l);
    const o = {
      id: uid('o'), listingId, buyerId: u.id, price: l.price, buyerFee: v.buyerFee, sellerFee: v.sellerFee, total: v.total, payout: v.payout,
      status: 'reserved', reservedUntil: new Date(Date.now() + holdMs()).toISOString(), createdAt: nowIso(), slip: null, dispute: null, history: [],
    };
    setStatus(o, 'reserved', u.id);
    l.status = 'reserved';
    S.orders.unshift(o);
    track('act_reserve', `${event(l.eventId).name} · ${type(l.ticketTypeId).name.en}`);
    save();
    return ok(orderView(o));
  },
  async submitPaymentSlip(orderId, file) {
    const u = requireUser();
    const o = order(orderId);
    if (!o || o.buyerId !== u.id || o.status !== 'reserved') throw new ServiceError('unavailable');
    if (!file || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) throw new ServiceError('fileError');
    o.slip = file;
    o.payment = { method: 'promptpay', at: nowIso() };
    setStatus(o, 'payment_submitted');
    track('act_slip', orderId);
    save();
  },
  // Card / Apple Pay. In production this creates a hosted checkout session with the payment
  // provider and the provider's webhook marks the order paid. Here it completes instantly.
  async payByCard(orderId, { method = 'card', simulateDecline = false } = {}) {
    const u = requireUser();
    const o = order(orderId);
    if (!settings.payments.card) throw new ServiceError('invalid');
    if (!o || o.buyerId !== u.id || o.status !== 'reserved') throw new ServiceError('unavailable');
    if (simulateDecline) {
      if (!TEST_MODE) throw new ServiceError('forbidden');
      track('act_carddecline', orderId);
      save();
      throw new ServiceError('cardDeclined');
    }
    const surcharge = cardSurcharge(o.total);
    o.payment = { method: method === 'apple_pay' ? 'apple_pay' : 'card', provider: 'sample', ref: uid('pay'), surcharge, charged: o.total + surcharge, at: nowIso() };
    setStatus(o, 'paid', 'system');
    listing(o.listingId).status = 'sold';
    track('act_cardpay', `${orderId} · ${o.payment.method}`);
    audit('card_payment', orderId, `${o.payment.method} ${o.payment.charged} THB (sample)`);
    save();
  },
  async cancelReservation(orderId) {
    const u = requireUser();
    const o = order(orderId);
    if (!o || o.buyerId !== u.id || o.status !== 'reserved') throw new ServiceError('invalid');
    setStatus(o, 'cancelled');
    listing(o.listingId).status = 'approved';
    track('act_cancel', orderId);
    save();
  },
  async myOrders() {
    sweep();
    const u = requireUser();
    return ok(S.orders.filter(o => o.buyerId === u.id).map(orderView));
  },
  async confirmEntry(orderId) {
    const u = requireUser();
    const o = order(orderId);
    if (!o || o.buyerId !== u.id || o.status !== 'transferred') throw new ServiceError('invalid');
    o.confirmedAt = nowIso();
    setStatus(o, 'confirmed');
    track('act_confirm', orderId);
    save();
  },
  async reportProblem(orderId, { reason, note = '', file = null }) {
    const u = requireUser();
    const o = order(orderId);
    if (!o || o.buyerId !== u.id || !['paid', 'transferred', 'confirmed'].includes(o.status)) throw new ServiceError('invalid');
    o.dispute = { reason, note, file, at: nowIso() };
    setStatus(o, 'disputed');
    track('act_dispute', `${orderId} · ${reason}`);
    save();
  },

  // Waitlist
  async joinWaitlist(eventId, { channel, contact, consent }) {
    if (!consent) throw new ServiceError('consent');
    if (!String(contact || '').trim()) throw new ServiceError('invalid');
    S.waitlist.unshift({ id: uid('w'), eventId, channel, contact: String(contact).trim(), consent: true, userId: S.currentUserId, createdAt: nowIso(), notifiedAt: null });
    track('act_waitlist', eventId);
    save();
  },

  // Partner page lead form (venues, promoters). Anyone can submit; only admins read.
  async submitPartnerLead(lead) {
    if (!lead.consent) throw new ServiceError('consent');
    const clean = v => String(v || '').trim().slice(0, 500);
    const email = clean(lead.email).toLowerCase();
    if (!clean(lead.firstName) || !clean(lead.company) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ServiceError('partnerFields');
    S.partnerLeads = S.partnerLeads || [];
    S.partnerLeads.unshift({
      id: uid('p'), firstName: clean(lead.firstName), lastName: clean(lead.lastName), email, contact: clean(lead.contact),
      company: clean(lead.company), roles: (lead.roles || []).slice(0, 9), city: lead.city, volume: lead.volume,
      ticketing: clean(lead.ticketing), message: clean(lead.message), consent: true, createdAt: nowIso(),
    });
    track('act_partner', clean(lead.company));
    save();
  },

  // Admin
  async adminData() {
    sweep();
    requireAdmin();
    const orders = S.orders.map(orderView);
    const byEvent = S.events.map(ev => {
      const rows = S.waitlist.filter(w => w.eventId === ev.id);
      return { event: ev, count: rows.length, pending: rows.filter(w => !w.notifiedAt).length };
    });
    const sellerIds = [...new Set(S.listings.map(l => l.sellerId))];
    return ok({
      pendingListings: S.listings.filter(l => l.status === 'pending').map(l => ({ ...listingView(l), event: event(l.eventId) })),
      payments: orders.filter(o => o.status === 'payment_submitted'),
      transfers: orders.filter(o => o.status === 'paid'),
      disputes: orders.filter(o => o.status === 'disputed'),
      payouts: orders.filter(o => o.status === 'confirmed'),
      waitlist: byEvent,
      sellers: sellerIds.map(id => ({ ...user(id), listings: S.listings.filter(l => l.sellerId === id).length })),
      partnerLeads: S.partnerLeads || [],
      audit: S.audit.slice(0, 100).map(a => ({ ...a, actorName: user(a.actorId)?.name || 'System' })),
    });
  },
  async approveListing(id) {
    const admin = requireAdmin();
    const l = listing(id);
    if (!l || l.status !== 'pending') throw new ServiceError('invalid');
    // Separation of duties: nobody approves their own ticket.
    if (l.sellerId === admin.id) throw new ServiceError('ownListing');
    l.status = 'approved';
    audit('approve_listing', id);
    track('act_approve', id);
    save();
  },
  async rejectListing(id, reason) {
    requireAdmin();
    if (!String(reason || '').trim()) throw new ServiceError('reasonRequired');
    const l = listing(id);
    if (!l || l.status !== 'pending') throw new ServiceError('invalid');
    l.status = 'rejected';
    l.rejectReason = reason.trim();
    audit('reject_listing', id, reason);
    track('act_reject', id);
    save();
  },
  async setBanned(userId, banned) {
    requireAdmin();
    const u = user(userId);
    if (!u || isAdmin(u)) throw new ServiceError('invalid');
    u.banned = !!banned;
    audit(banned ? 'ban_user' : 'unban_user', userId);
    track(banned ? 'act_ban' : 'act_unban', u.name);
    save();
  },
  async getListingFile(id) {
    requireAdmin();
    const l = listing(id);
    if (!l) throw new ServiceError('invalid');
    audit('view_ticket_file', id);
    save();
    return ok(l.file);
  },
  async getSlip(orderId) {
    requireAdmin();
    const o = order(orderId);
    if (!o) throw new ServiceError('invalid');
    return ok(o.slip);
  },
  async markPaymentReceived(orderId) {
    requireAdmin();
    const o = order(orderId);
    if (!o || o.status !== 'payment_submitted') throw new ServiceError('invalid');
    setStatus(o, 'paid');
    listing(o.listingId).status = 'sold';
    audit('payment_received', orderId);
    track('act_paid', orderId);
    save();
  },
  async rejectPayment(orderId, reason) {
    requireAdmin();
    if (!String(reason || '').trim()) throw new ServiceError('reasonRequired');
    const o = order(orderId);
    if (!o || o.status !== 'payment_submitted') throw new ServiceError('invalid');
    o.cancelReason = reason.trim();
    setStatus(o, 'cancelled');
    listing(o.listingId).status = 'approved';
    audit('payment_rejected', orderId, reason);
    track('act_payreject', orderId);
    save();
  },
  async releasePayout(orderId) {
    requireAdmin();
    const o = order(orderId);
    if (!o || !['confirmed', 'disputed'].includes(o.status)) throw new ServiceError('invalid');
    setStatus(o, 'payout_released');
    const seller = user(listing(o.listingId).sellerId);
    seller.swaps = (seller.swaps || 0) + 1;
    audit('payout_released', orderId, `${o.payout} THB`);
    track('act_payout', orderId);
    save();
  },
  async refundOrder(orderId, note = '') {
    requireAdmin();
    const o = order(orderId);
    if (!o || !['paid', 'transferred', 'disputed'].includes(o.status)) throw new ServiceError('invalid');
    setStatus(o, 'refunded');
    listing(o.listingId).status = 'withdrawn';
    audit('refund', orderId, note);
    track('act_refund', orderId);
    save();
  },
  async notifyWaitlist(eventId) {
    requireAdmin();
    const rows = S.waitlist.filter(w => w.eventId === eventId && !w.notifiedAt);
    rows.forEach(w => { w.notifiedAt = nowIso(); });
    audit('notify_waitlist', eventId, `${rows.length} contacts (simulated)`);
    track('act_notify', `${eventId} · ${rows.length}`);
    save();
    return rows.length;
  },

  // Pilot & data
  async pilotData() {
    requireAdmin();
    const c = type => S.activity.filter(a => a.type === type).length;
    return ok({
      counts: {
        views: c('act_view'), holds: c('act_reserve'), paid: c('act_paid'), confirmed: c('act_confirm') + c('act_autoconfirm'),
        disputes: c('act_dispute'), listings: c('act_listing'), waitlist: S.waitlist.length, partners: (S.partnerLeads || []).length,
      },
      activity: S.activity.slice(0, 60),
      feedback: S.feedback,
    });
  },
  async addFeedback({ channel, text }) {
    if (!String(text || '').trim()) throw new ServiceError('invalid');
    S.feedback.unshift({ at: nowIso(), channel, text: String(text).trim() });
    track('act_feedback', channel);
    save();
  },
  async exportData() {
    requireAdmin();
    return JSON.stringify({
      exportedAt: nowIso(), activity: S.activity, feedback: S.feedback,
      orders: S.orders.map(o => ({ id: o.id, status: o.status, total: o.total, createdAt: o.createdAt })),
      waitlistByEvent: S.events.map(e => ({ event: e.id, signups: S.waitlist.filter(w => w.eventId === e.id).length })),
    }, null, 2);
  },

  // Test tools (demo builds only)
  async listUsers() { requireTestMode(); return ok(S.users.filter(u => !u.deleted)); },
  async actAs(userId) {
    requireTestMode();
    if (userId && !user(userId)) throw new ServiceError('invalid');
    S.currentUserId = userId || null;
    save();
  },
  async addUser({ name, email, roles }) {
    requireTestMode();
    const clean = String(email || '').trim().toLowerCase();
    if (!String(name || '').trim() || !clean.includes('@')) throw new ServiceError('invalid');
    if (S.users.some(u => u.email === clean)) throw new ServiceError('invalid');
    const u = { id: uid('u'), name: name.trim(), email: clean, roles: roles?.length ? roles : ['buyer'], banned: false, verified: true, lineId: '', consentAt: nowIso(), swaps: 0 };
    S.users.push(u);
    audit('add_test_user', u.id, u.roles.join(','));
    save();
    return ok(u);
  },
  async createOrderFor(buyerId, listingId) {
    requireTestMode();
    if (!user(buyerId)) throw new ServiceError('invalid');
    return this.reserveListing(listingId, buyerId);
  },
  async liveListingsForTest() {
    requireTestMode();
    return ok(S.listings.filter(l => l.status === 'approved').map(l => ({ ...listingView(l), event: event(l.eventId) })));
  },
  async getTestSettings() { requireTestMode(); return ok(S.testSettings); },
  async setTestSettings(next) {
    requireTestMode();
    S.testSettings = { ...S.testSettings, ...next };
    audit('test_settings', '', JSON.stringify(S.testSettings));
    save();
  },
  async runTimers() { requireTestMode(); sweep(); save(); },
  async resetDemo() {
    requireTestMode();
    const current = S.currentUserId;
    S = seed();
    if (current && S.users.some(u => u.id === current)) S.currentUserId = current;
    save();
  },
};
