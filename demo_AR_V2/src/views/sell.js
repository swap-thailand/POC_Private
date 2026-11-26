import { t, tx, getLang } from '../i18n/index.js';
import { quote, maxListingPrice } from '../lib/fees.js';
import { esc, baht, eventDate } from '../lib/format.js';
import { fileDrop, chip, typeName, narrow } from './components.js';

// The quote box re-renders on every keystroke without touching the rest of the form.
export function sellSummary(state) {
  const ev = state.events.find(e => e.id === state.sell.eventId);
  const tt = ev?.ticketTypes.find(x => x.id === state.sell.ticketTypeId);
  if (!ev || !tt) return '';
  const max = maxListingPrice(tt.faceValue, ev.strictFaceValue);
  const price = Number(state.sell.price);
  const hint = ev.strictFaceValue ? t('strictMax', { max: baht(max) }) : t('maxPrice', { max: baht(max) });
  if (!price) return `<p class="mini">${hint}</p>`;
  if (!Number.isInteger(price) || price <= 0) return `<p class="mini">${hint}</p><p class="notice warn">${t('wholeBaht')}</p>`;
  const q = quote(price, tt.faceValue, ev.strictFaceValue);
  if (!q.ok) return `<p class="mini">${hint}</p><p class="notice warn">${t('tooHigh')}</p>`;
  return `<p class="mini">${hint}</p><dl class="kv quote"><dt>${t('buyerPays')}</dt><dd>${baht(q.total)}</dd>
    <dt class="tot">${t('youGet')}</dt><dd class="tot">${baht(q.payout)}</dd></dl>`;
}

export async function sellView({ api, user, state }) {
  if (!user) return narrow(`<h1 class="page-title">${t('sellTitle')}</h1><p>${t('signInToSell')}</p><a class="btn primary" href="#account">${t('signIn')}</a>`);
  if (user.banned) return narrow(`<h1 class="page-title">${t('sellTitle')}</h1><p class="notice warn">${t('bannedMsg')}</p>`);
  state.events = await api.listEvents();
  const s = state.sell;
  if (!state.events.some(e => e.id === s.eventId)) s.eventId = state.events[0]?.id || '';
  const ev = state.events.find(e => e.id === s.eventId);
  if (!ev?.ticketTypes.some(x => x.id === s.ticketTypeId)) s.ticketTypeId = ev?.ticketTypes[0]?.id || '';
  return narrow(`<h1 class="page-title">${t('sellTitle')}</h1>
  <div class="form sell-v2">
    <label>1 · ${t('s1')}<select data-input="sellEvent">${state.events.map(e => `<option value="${esc(e.id)}" ${e.id === s.eventId ? 'selected' : ''}>${esc(e.name)} · ${esc(eventDate(e.startsAt, getLang()))}</option>`).join('')}</select></label>
    ${ev?.strictFaceValue ? `<p class="notice">${t('strictNote')}</p>` : ''}
    <label>2 · ${t('s2')}<select data-input="sellType">${(ev?.ticketTypes || []).map(tt => `<option value="${esc(tt.id)}" ${tt.id === s.ticketTypeId ? 'selected' : ''}>${typeName(tt)} · ${t('faceValue')} ${baht(tt.faceValue)}</option>`).join('')}</select></label>
    <div class="field">3 · ${t('s3')}${fileDrop('ticketFile', t('upHint'), s.file)}</div>
    <label>4 · ${t('s4')}<input type="number" inputmode="numeric" min="1" step="1" data-input="sellPrice" value="${esc(s.price)}" placeholder="0"></label>
    <div id="sellSummary">${sellSummary(state)}</div>
    <button class="btn primary wide" data-action="submitListing">${t('submit')}</button>
  </div>`);
}

function listingStatus(l) {
  const o = l.order;
  if (l.status === 'rejected') return `<p class="notice warn">${t('rejectReason', { r: esc(l.rejectReason) })}</p>`;
  if (!o) return '';
  switch (o.status) {
    case 'reserved': return `<p class="mini">${t('waitingPayment')}</p>`;
    case 'payment_submitted': return `<p class="mini">${t('checkingPayment')}</p>`;
    case 'paid': return `<div class="notice"><b>${t('transferNow')}</b><p>${t('transferTo', { buyer: esc(o.buyer.name) })}</p><p class="mini">${esc(tx(o.event.transfer))}</p></div>`;
    case 'transferred': case 'confirmed': return `<p class="mini">${chip(o.status)} ${t('payoutPending')}</p>`;
    case 'disputed': return `<p class="notice warn">${t('disputeOpen')}</p>`;
    case 'payout_released': return `<p class="notice ok">${t('payoutDone', { amount: baht(o.payout) })}</p>`;
    case 'refunded': return `<p class="mini">${chip('refunded')}</p>`;
    default: return '';
  }
}

export async function listingsView({ api, user }) {
  if (!user) return narrow(`<h1 class="page-title">${t('myListings')}</h1><a class="btn primary" href="#account">${t('signIn')}</a>`);
  const rows = await api.myListings();
  return narrow(`<h1 class="page-title">${t('myListings')}</h1>
  ${rows.length ? rows.map(l => `<div class="listing-row" data-listing="${esc(l.id)}">
    <div><span class="kicker">${esc(l.event?.name || '')}</span><h3>${typeName(l.ticketType)}</h3>
    <p class="mini">${t('listedPrice')} ${baht(l.price)} · ${t('youGet')} ${baht(l.payout ?? l.price)}</p>${listingStatus(l)}</div>
    <div class="lr-actions">${chip(l.status, 'ls_')}
      ${['pending', 'approved'].includes(l.status) ? `<button class="btn ghost sm" data-action="withdraw" data-id="${esc(l.id)}">${t('withdraw')}</button>` : ''}
      ${l.order?.status === 'paid' ? `<button class="btn primary sm" data-action="markTransferred" data-id="${esc(l.order.id)}">${t('markTransferred')}</button>` : ''}
    </div></div>`).join('') : `<div class="empty"><p>${t('noListings')}</p><a class="btn primary" href="#sell">${t('navSell')}</a></div>`}`);
}
