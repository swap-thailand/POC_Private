import { t, tx, getLang } from '../i18n/index.js';
import { settings, TEST_MODE } from '../config/settings.js';
import { cardSurcharge } from '../lib/fees.js';
import { esc, baht, eventDate, countdown } from '../lib/format.js';
import { chip, timeline, qr, fileDrop, priceLines, typeName, narrow } from './components.js';

function body(o, state, timing) {
  const now = Date.now();
  switch (o.status) {
    case 'reserved': {
      const slip = state.slips[o.id];
      const p = settings.payments;
      const method = p.card && (state.payMethod[o.id] === 'card' || !p.promptpay) ? 'card' : 'promptpay';
      const tabs = p.card && p.promptpay ? `<div class="seg pay-seg" role="tablist" aria-label="${t('payHow')}">
          <button role="tab" aria-selected="${method === 'promptpay'}" class="${method === 'promptpay' ? 'on' : ''}" data-action="payMethod" data-id="${esc(o.id)}" data-method="promptpay">PromptPay</button>
          <button role="tab" aria-selected="${method === 'card'}" class="${method === 'card' ? 'on' : ''}" data-action="payMethod" data-id="${esc(o.id)}" data-method="card">${t('payCardTab')}</button></div>` : '';
      const surcharge = cardSurcharge(o.total);
      const promptpay = `<h4>${t('payTitle')}</h4>
        <div class="pay-box">${qr()}<div><p>${t('payInstr', { amount: `<b>${baht(o.total)}</b>` })}</p><p class="mini">${t('qrPlaceholder')}</p></div></div>
        ${fileDrop('slip-' + o.id, t('uploadSlip'), slip, 'image/jpeg,image/png,application/pdf')}
        <div class="btn-row"><button class="btn primary" data-action="submitSlip" data-id="${esc(o.id)}">${t('submitSlip')}</button>
        <button class="btn ghost" data-action="cancelHold" data-id="${esc(o.id)}">${t('cancelHold')}</button></div>`;
      const card = `<h4>${t('payCardTitle')}</h4>
        <p>${t('payCardInstr', { amount: `<b>${baht(o.total + surcharge)}</b>` })}</p>
        ${surcharge ? `<p class="mini">${t('cardSurchargeNote', { fee: baht(surcharge) })}</p>` : ''}
        <div class="pay-card-btns"><button class="apple" data-action="openCheckout" data-id="${esc(o.id)}" data-method="apple_pay">Apple Pay</button>
        <button class="btn primary" data-action="openCheckout" data-id="${esc(o.id)}" data-method="card">${t('payByCard')}</button></div>
        <p class="mini">${t('payCardSafe')}</p>
        <div class="btn-row"><button class="btn ghost" data-action="cancelHold" data-id="${esc(o.id)}">${t('cancelHold')}</button></div>`;
      return `<p class="countdown" data-countdown="${esc(o.reservedUntil)}" data-label="holdLeft">${t('holdLeft', { t: countdown(new Date(o.reservedUntil) - now) })}</p>
        ${tabs}${method === 'card' ? card : promptpay}`;
    }
    case 'payment_submitted': return `<p class="notice">${t('slipWaiting')}</p>`;
    case 'paid': return `${o.payment && o.payment.method !== 'promptpay' ? `<p class="mini">${t('paidWith', { method: methodLabel(o.payment.method) })}</p>` : ''}<p class="notice">${t('transferWait')}</p><h4>${t('instructions')}</h4><p>${esc(tx(o.event.transfer))}</p>`;
    case 'transferred': {
      const note = timing.fastTimers ? t('windowFast', { s: settings.test.fastConfirmSeconds })
        : t('windowNote', { hours: settings.confirmWindowHours, min: settings.minConfirmAfterTransferHours });
      return `<h4>${t('confirmTitle')}</h4>
        <p data-countdown="${esc(o.confirmDeadline)}" data-label="autoConfirmIn">${t('autoConfirmIn', { t: `<b>${countdown(new Date(o.confirmDeadline) - now)}</b>` })}</p>
        <p class="mini">${note}</p>
        <div class="btn-row"><button class="btn primary" data-action="confirmEntry" data-id="${esc(o.id)}">${t('confirmIn')}</button>
        <button class="btn ghost" data-action="openDispute" data-id="${esc(o.id)}">${t('reportProblem')}</button></div>`;
    }
    case 'confirmed': return `<p class="notice ok">${t('confirmedMsg')}</p><button class="alert-link" data-action="openDispute" data-id="${esc(o.id)}">${t('reportProblem')}</button>`;
    case 'disputed': return `<p class="notice warn">${t('disputedMsg')}</p>`;
    case 'payout_released': return `<p class="notice ok">${t('paidOutMsg')}</p>`;
    case 'refunded': return `<p class="notice">${t('refundedMsg')}</p>`;
    case 'expired': return `<p class="notice">${t('expiredMsg')}</p>`;
    case 'cancelled': return `<p class="notice">${t('cancelledMsg')}${o.cancelReason ? ' · ' + esc(o.cancelReason) : ''}</p>`;
    default: return '';
  }
}

export const methodLabel = m => (m === 'apple_pay' ? 'Apple Pay' : m === 'card' ? t('cardLabel') : 'PromptPay');

// Stand-in for the payment provider's hosted checkout. No card fields: in production the
// buyer types card details on the provider's page (or uses Apple Pay), never in our app.
export function checkoutModal(o, method) {
  const total = o.total + cardSurcharge(o.total);
  return `<span class="badge">${t('sampleCheckout')}</span><h2 id="modalTitle">${method === 'apple_pay' ? 'Apple Pay' : t('payByCard')}</h2>
    <p class="muted">${esc(o.event.name)} · ${typeName(o.ticketType)}</p>
    <dl class="kv" style="margin-top:14px"><dt class="tot">${t('total')}</dt><dd class="tot">${baht(total)}</dd></dl>
    <p class="notice">${t('checkoutNote')}</p>
    <button class="${method === 'apple_pay' ? 'apple wide-apple' : 'btn primary wide'}" data-action="payCard" data-id="${esc(o.id)}" data-method="${esc(method)}">${method === 'apple_pay' ? 'Apple Pay · ' + baht(total) : t('confirmPay', { amount: baht(total) })}</button>
    ${TEST_MODE ? `<button class="alert-link" data-action="declineCard" data-id="${esc(o.id)}" data-method="${esc(method)}">${t('simulateDecline')}</button>` : ''}`;
}

export function orderCard(o, state, timing) {
  return `<article class="order" data-order="${esc(o.id)}">
    <div class="order-head"><div><span class="kicker">${t('order')} ${esc(o.id.slice(-6).toUpperCase())}</span>
      <h2>${esc(o.event.name)}</h2><p class="muted">${typeName(o.ticketType)} · ${esc(eventDate(o.event.startsAt, getLang()))} · ${esc(o.event.venue)}</p></div>
      ${chip(o.status)}</div>
    ${timeline(o)}
    <div class="order-grid"><div>${body(o, state, timing)}</div>
    <aside>${priceLines(o)}<p class="mini" style="margin-top:10px">${t('seller')}: ${esc(o.seller.name)}</p></aside></div>
  </article>`;
}

export async function ticketsView({ api, user, state }) {
  if (!user) return narrow(`<h1 class="page-title">${t('myTickets')}</h1><p>${t('signInToBuy')}</p><a class="btn primary" href="#account">${t('signIn')}</a>`);
  const orders = await api.myOrders();
  const timing = api.timing();
  return narrow(`<h1 class="page-title">${t('myTickets')}</h1>
    ${!api.capabilities.checkout ? `<p class="notice">${t('notConnected')}</p>` : ''}
    ${orders.length ? orders.map(o => orderCard(o, state, timing)).join('') : `<div class="empty"><p>${t('noOrders')}</p><a class="btn primary" href="#home">${t('ctaBuy')}</a></div>`}`);
}

export function disputeModal(orderId, meta) {
  return `<h2 id="modalTitle">${t('disputeTitle')}</h2>
  <form class="form" data-form="dispute" data-id="${esc(orderId)}">
    <label>${t('reasonLabel')}<select name="reason">
      ${['invalid', 'notReceived', 'wrong', 'other'].map(r => `<option value="${r}">${t('reason_' + r)}</option>`).join('')}</select></label>
    <label>${t('note')}<textarea name="note" rows="3"></textarea></label>
    <div class="field">${t('evidence')}${fileDrop('evidence', t('evidence'), meta, 'image/jpeg,image/png,application/pdf')}</div>
    <button class="btn primary wide" type="submit">${t('sendReport')}</button>
  </form>`;
}
