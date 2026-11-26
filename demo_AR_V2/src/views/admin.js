import { t, getLang } from '../i18n/index.js';
import { esc, baht, dateTime } from '../lib/format.js';
import { chip, typeName, section } from './components.js';
import { partnerLeadRows } from './partners.js';

const TABS = [
  ['listings', 'tabListings', d => d.pendingListings.length],
  ['payments', 'tabPayments', d => d.payments.length],
  ['transfers', 'tabTransfers', d => d.transfers.length],
  ['disputes', 'tabDisputes', d => d.disputes.length],
  ['payouts', 'tabPayouts', d => d.payouts.length],
  ['waitlist', 'tabWaitlist', d => d.waitlist.reduce((n, w) => n + w.pending, 0)],
  ['sellers', 'tabSellers', () => 0],
  ['partners', 'tabPartners', d => d.partnerLeads.length],
  ['audit', 'tabAudit', () => 0],
];

const empty = () => `<p class="muted" style="padding:16px 0">${t('queueEmpty')}</p>`;
const reasonBox = id => `<input class="reason" id="reason-${esc(id)}" placeholder="${t('rejectReasonPh')}" aria-label="${t('rejectReasonPh')}">`;
const payLabel = o => (o.payment?.method === 'apple_pay' ? 'Apple Pay' : o.payment?.method === 'card' ? t('cardLabel') : '');
const orderLine = o => `${esc(o.event.name)} · ${typeName(o.ticketType)} · ${t('buyer')}: ${esc(o.buyer.name)} · ${t('seller')}: ${esc(o.seller.name)}${payLabel(o) ? ' · ' + payLabel(o) : ''}`;

const panels = {
  listings: d => d.pendingListings.map(l => `<div class="arow" data-row="${esc(l.id)}"><div>
      <h3>${esc(l.event.name)} · ${typeName(l.ticketType)}</h3>
      <p>${baht(l.price)} (${t('faceValue')} ${baht(l.faceValue)}) · ${t('by', { name: esc(l.seller.name) })}${l.seller.verified ? '' : ' · unverified'}</p></div>
      <div class="btn-row"><button class="btn ghost sm" data-action="viewFile" data-id="${esc(l.id)}">${t('viewFile')}</button>
      <button class="btn primary sm" data-action="approve" data-id="${esc(l.id)}">${t('approve')}</button>
      ${reasonBox(l.id)}<button class="btn ghost sm" data-action="reject" data-id="${esc(l.id)}">${t('reject')}</button>
      <button class="btn ghost sm" data-action="ban" data-id="${esc(l.seller.id)}">${t('ban')}</button></div></div>`).join('') || empty(),

  payments: d => d.payments.map(o => `<div class="arow" data-row="${esc(o.id)}"><div>
      <h3>${baht(o.total)} · ${esc(o.id.slice(-6).toUpperCase())}</h3><p>${orderLine(o)}</p></div>
      <div class="btn-row"><button class="btn ghost sm" data-action="viewSlip" data-id="${esc(o.id)}">${t('viewFile')}</button>
      <button class="btn primary sm" data-action="markReceived" data-id="${esc(o.id)}">${t('markReceived')}</button>
      ${reasonBox(o.id)}<button class="btn ghost sm" data-action="rejectPayment" data-id="${esc(o.id)}">${t('rejectPayment')}</button></div></div>`).join('') || empty(),

  transfers: d => d.transfers.map(o => `<div class="arow" data-row="${esc(o.id)}"><div>
      <h3>${esc(o.id.slice(-6).toUpperCase())} · ${o.eventStarted ? `<span class="chip s-disputed">${t('overdue')}</span>` : t('awaitingTransfer')}</h3><p>${orderLine(o)}</p></div>
      <div class="btn-row"><button class="btn ghost sm" data-action="refund" data-id="${esc(o.id)}">${t('refund')}</button></div></div>`).join('') || empty(),

  disputes: d => d.disputes.map(o => `<div class="arow" data-row="${esc(o.id)}"><div>
      <h3>${t('reason_' + o.dispute.reason)}</h3><p>${orderLine(o)}</p>${o.dispute.note ? `<p>“${esc(o.dispute.note)}”</p>` : ''}</div>
      <div class="btn-row">${o.dispute.file ? `<button class="btn ghost sm" data-action="viewEvidence" data-id="${esc(o.id)}">${t('viewFile')}</button>` : ''}
      <button class="btn primary sm" data-action="refund" data-id="${esc(o.id)}">${t('refund')}</button>
      <button class="btn ghost sm" data-action="releasePayout" data-id="${esc(o.id)}">${t('payoutInstead')}</button></div></div>`).join('') || empty(),

  payouts: d => d.payouts.map(o => `<div class="arow" data-row="${esc(o.id)}"><div>
      <h3>${baht(o.payout)} → ${esc(o.seller.name)}</h3><p>${orderLine(o)}</p></div>
      <div class="btn-row"><button class="btn primary sm" data-action="releasePayout" data-id="${esc(o.id)}">${t('releasePayout')}</button></div></div>`).join('') || empty(),

  waitlist: d => d.waitlist.map(w => `<div class="arow"><div><h3>${esc(w.event.name)}</h3><p>${t('signups', { n: w.count })} · ${w.pending} pending</p></div>
      <div class="btn-row"><button class="btn ghost sm" data-action="notify" data-id="${esc(w.event.id)}" ${w.pending ? '' : 'disabled'}>${t('notifyWaitlist')}</button></div></div>`).join(''),

  sellers: d => d.sellers.map(s => `<div class="arow"><div><h3>${esc(s.name)} ${s.banned ? `<span class="chip s-banned">${t('banned')}</span>` : ''}</h3>
      <p>${esc(s.email)} · ${t('listingsCount', { n: s.listings })}${s.verified ? ' · ✔ ' + t('verified') : ''}</p></div>
      <div class="btn-row">${s.roles?.includes('admin') ? '' : `<button class="btn ghost sm" data-action="${s.banned ? 'unban' : 'ban'}" data-id="${esc(s.id)}">${s.banned ? t('unban') : t('ban')}</button>`}</div></div>`).join(''),

  partners: d => partnerLeadRows(d.partnerLeads),

  audit: d => `<div class="audit">${d.audit.map(a => `<div><b>${esc(a.action)}</b> · ${esc(a.target)} ${a.detail ? '· ' + esc(a.detail) : ''}<br><span class="mini">${esc(dateTime(a.at, getLang()))} · ${esc(a.actorName)}</span></div>`).join('') || empty()}</div>`,
};

export async function adminView({ api, user, state }) {
  state.admin = null;
  if (!user?.roles?.includes('admin') || !api.capabilities.admin) return section(`<h1 class="page-title">${t('adminTitle')}</h1><p class="notice">${api.capabilities.admin ? t('adminOnly') : t('notConnected')}</p>`);
  const d = await api.adminData();
  state.admin = d;
  const tab = TABS.some(x => x[0] === state.adminTab) ? state.adminTab : 'listings';
  return section(`<h1 class="page-title">${t('adminTitle')}</h1>
    <div class="admin-tabs" role="tablist">${TABS.map(([id, key, n]) => {
      const c = n(d);
      return `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? 'on' : ''}" data-action="adminTab" data-id="${id}">${t(key)}${c ? `<span class="count">${c}</span>` : ''}</button>`;
    }).join('')}</div>
    <div class="admin-panel">${panels[tab](d)}</div>`);
}

export function fileModal(file) {
  if (!file) return `<h2 id="modalTitle">${t('viewFile')}</h2><p>${t('noPreview')}</p>`;
  const kb = Math.round((file.size || 0) / 1024);
  const preview = file.dataUrl && /^data:image\/(png|jpeg);/.test(file.dataUrl)
    ? `<img class="file-preview" src="${esc(file.dataUrl)}" alt="${esc(file.name)}">`
    : `<p class="notice">${t('noPreview')}</p>`;
  return `<h2 id="modalTitle">${esc(file.name)}</h2><p class="mini">${esc(file.type)} · ${kb} KB</p>${preview}`;
}
