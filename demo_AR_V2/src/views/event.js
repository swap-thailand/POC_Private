import { t, tx, getLang } from '../i18n/index.js';
import { settings } from '../config/settings.js';
import { esc, baht, eventDate, num } from '../lib/format.js';
import { poster, priceLines, sellerLine, typeName, markupBadge, heart } from './components.js';

function listingRow(l, user) {
  const own = user && l.seller?.id === user.id;
  return `<article class="row-card" data-action="openListing" data-id="${esc(l.id)}" tabindex="0" role="button" aria-label="${typeName(l.ticketType)} ${baht(l.total)}">
    <div class="rc-type"><b>${typeName(l.ticketType)}</b>${markupBadge(l.price, l.faceValue)}</div>
    ${sellerLine(l.seller)}
    <div class="rc-price"><b>${baht(l.total)}</b><small>${l.buyerFee ? t('incl', { fee: l.buyerFee }) : t('noFee')}</small></div>
    <span class="btn primary sm">${own ? t('ownListing') : t('buy')}</span></article>`;
}

// RA-style "Interested" button with the live count. Signed-out visitors are sent to sign in.
function interestButton(e, user) {
  if (!e.interestEnabled) return '';
  const count = `<span class="int-count">${t('interestPeople', { n: num(e.interestedCount) })}</span>`;
  if (!user && !e.sample) return `<a class="interest-btn" href="#account">${heart(false)} ${t('interestBtn')}</a>${count}`;
  return `<button class="interest-btn ${e.youInterested ? 'on' : ''}" data-action="toggleInterest" data-id="${esc(e.id)}" aria-pressed="${e.youInterested}">${heart(e.youInterested)} ${t('interestBtn')}</button>${count}`;
}

export async function eventView({ api, state, user }, id) {
  const res = await api.getEvent(id);
  if (!res) return `<section class="section"><div class="wrap"><p>${t('noResults')}</p><a class="btn primary" href="#home">${t('back')}</a></div></section>`;
  const { event: e, listings } = res;
  state.eventListings = listings;
  state.currentEvent = e;
  return `
<section class="ev-hero"><div class="wrap"><a class="back" href="#home">← ${t('back')}</a>
  <div class="ev-hero-grid">${poster(e, true)}<div class="ev-head"><span class="kicker">${esc(eventDate(e.startsAt, getLang()))} · ${esc(e.venue)}, ${esc(e.city)}</span>
  <h1>${esc(e.name)}</h1><p class="lead">${esc(e.subtitle)} · ${esc(e.artists.join(', '))}</p>
  <div class="ev-actions">${interestButton(e, user)}<div class="avail"><span class="dot"></span>${t('available', { n: listings.length })}</div></div>
  ${e.sample ? `<p class="notice ex-notice">${t('exEventNotice')}</p>` : ''}
  ${e.strictFaceValue ? `<p class="notice">${t('strictNote')}</p>` : ''}
  <h4 class="mini">${t('ticketTypes')}</h4>
  <div class="types">${e.ticketTypes.map(tt => `<span class="type-pill">${typeName(tt)}<small>${t('faceValue')} ${baht(tt.faceValue)}</small></span>`).join('')}</div>
  <div class="guarantee"><span>🛡</span><div><b>${t('gTitle')}</b><p>${t('gBody')}</p></div></div>
  <p class="transfer"><b>${t('transfer')}:</b> ${esc(tx(e.transfer))}</p></div></div></div></section>
<section class="section tight"><div class="wrap"><div class="listings">
  ${listings.length ? listings.map(l => listingRow(l, user)).join('') : `<div class="empty"><p>${t('none')}</p><button class="btn primary" data-action="openWaitlist" data-id="${esc(e.id)}">🔔 ${t('alert')}</button></div>`}
</div>${listings.length ? `<button class="alert-link" data-action="openWaitlist" data-id="${esc(e.id)}">🔔 ${t('alert')}</button>` : ''}</div></section>`;
}

export function listingModal(l, event, user) {
  const own = user && l.seller?.id === user.id;
  const cta = event.sample ? `<p class="notice ex-notice">${t('exOnly')}</p>`
    : !user
    ? `<a class="btn primary wide" href="#account" data-action="closeModal">${t('signInToBuy')}</a>`
    : own ? `<p class="notice">${t('ownListing')}</p>`
      : `<button class="btn primary wide" data-action="reserve" data-id="${esc(l.id)}">${t('reserveCta', { min: settings.holdMinutes })}</button><p class="mini" style="margin-top:8px">${t('reserveNote')}</p>`;
  return `${markupBadge(l.price, l.faceValue)}<h2 id="modalTitle">${typeName(l.ticketType)}</h2>
    <p class="muted">${esc(event.name)} · ${esc(eventDate(event.startsAt, getLang()))}</p>
    <h4>${t('details')}</h4>
    <dl class="kv"><dt>${t('faceValue')}</dt><dd>${baht(l.faceValue)}</dd><dt>${t('transfer')}</dt><dd>${esc(tx(event.transfer))}</dd></dl>
    <div style="margin-top:14px">${priceLines(l)}</div>
    <div style="margin-top:16px">${sellerLine(l.seller)}</div>
    <p class="escrow">🛡 ${t('escrow')}</p>
    ${cta}`;
}

export function waitlistModal(event) {
  return `<h2 id="modalTitle">${t('wlTitle', { event: esc(event.name) })}</h2>
  <form class="form" data-form="waitlist" data-id="${esc(event.id)}">
    <fieldset class="field"><legend>${t('wlChannel')}</legend>
      <label class="check"><input type="radio" name="channel" value="line" checked> ${t('wlLine')}</label>
      <label class="check"><input type="radio" name="channel" value="email"> ${t('wlEmail')}</label></fieldset>
    <label>${t('wlContact')}<input type="text" name="contact" required autocomplete="off"></label>
    <label class="check"><input type="checkbox" name="consent"> ${t('wlConsent')}</label>
    <button class="btn primary wide" type="submit">${t('wlJoin')}</button>
  </form>`;
}
