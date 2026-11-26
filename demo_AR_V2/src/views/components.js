import { t, tx, getLang } from '../i18n/index.js';
import { esc, baht, eventDate } from '../lib/format.js';

const PALETTE = [
  'linear-gradient(160deg,#ff6aa2 0%,#ff3b30 55%,#7a00ff 100%)',
  'linear-gradient(160deg,#ffe14f 0%,#ff8a00 100%)',
  'linear-gradient(160deg,#00d4ff 0%,#6b3bff 55%,#ff2bd6 100%)',
  'linear-gradient(160deg,#3cf0b0 0%,#0094ff 100%)',
];
const KNOWN = ['wp', 'clutch', 'edc', 's2o'];
// Real events from the database get the same poster art when their poster title or name matches.
const MATCH = { wp: /white\s*party/i, clutch: /clutch/i, edc: /\bedc\b/i, s2o: /\bs2o\b/i };
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function posterKey(ev) {
  if (KNOWN.includes(ev.posterKey)) return ev.posterKey;
  if (KNOWN.includes(ev.id)) return ev.id;
  const text = `${ev.posterTitle || ''} ${ev.name || ''}`;
  return KNOWN.find(k => MATCH[k].test(text)) || null;
}

export function poster(ev, big = false) {
  const key = posterKey(ev);
  const style = key ? '' : ` style="--p-bg:${PALETTE[hash(ev.id) % PALETTE.length]}"`;
  return `<div class="poster ${key ? 'p-' + key : ''} ${big ? 'big' : ''}"${style}>
    ${ev.sample ? `<span class="ex-badge">${t('exBadge')}</span>` : ''}
    <span class="p-date">${esc(eventDate(ev.startsAt, getLang()))}</span>
    <span class="p-name">${esc(ev.posterTitle || ev.name)}</span>
    <span class="p-venue">${esc(ev.venue)} · ${esc(ev.city)}</span></div>`;
}

export const chip = (status, prefix = 'st_') => `<span class="chip s-${esc(status)}">${esc(t(prefix + status))}</span>`;

const STEPS = ['reserved', 'paid', 'transferred', 'confirmed', 'payout_released'];
const STEP_LABEL = ['tl_reserved', 'tl_payment', 'tl_transfer', 'tl_confirm', 'tl_payout'];
export function timeline(order) {
  const seen = new Set(order.history.map(h => h.status));
  const bad = ['disputed', 'refunded', 'expired', 'cancelled'].includes(order.status);
  let last = -1;
  STEPS.forEach((s, i) => { if (seen.has(s)) last = i; });
  return `<ol class="timeline" aria-label="Order progress">${STEPS.map((s, i) => {
    const cls = i <= last ? 'done' : '';
    const badCls = bad && i === last + 1 ? 'bad' : '';
    return `<li class="${cls} ${badCls}"><span></span>${esc(t(STEP_LABEL[i]))}</li>`;
  }).join('')}</ol>`;
}

export function qr() {
  let s = '';
  for (let i = 0; i < 121; i++) {
    const r = Math.floor(i / 11), c = i % 11;
    const k = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3) || ((i * 7 + r * 3 + c) % 3 === 0);
    s += `<i class="${k ? 'k' : ''}"></i>`;
  }
  return `<div class="qr-grid" aria-hidden="true">${s}</div>`;
}

export function fileDrop(id, label, meta, accept = 'application/pdf,image/jpeg,image/png') {
  return `<label class="file-drop ${meta ? 'done' : ''}" for="${id}">
    <input type="file" id="${id}" data-file="${id}" accept="${accept}">
    <span class="fd-text">${meta ? '✔ ' + esc(meta.name) : '⬆ ' + esc(label)}</span></label>`;
}

// Heart for the Interested button and counts: outline when off, filled when on.
export const heart = on => `<svg class="heart" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

// Badge showing where a listing sits against face value: "Face value" or "+9% over face".
export function markupBadge(price, face) {
  const m = face ? Math.round((price / face - 1) * 100) : 0;
  return `<span class="badge ${m > 0 ? 'badge-up' : ''}">${m > 0 ? t('overFace', { p: m }) : t('atFace')}</span>`;
}

export function priceLines({ price, buyerFee, total }) {
  return `<dl class="kv"><dt>${t('listedPrice')}</dt><dd>${baht(price)}</dd>
    <dt>${t('protectionFee')}</dt><dd>${buyerFee ? baht(buyerFee) : t('noFee')}</dd>
    <dt class="tot">${t('total')}</dt><dd class="tot">${baht(total)}</dd></dl>`;
}

export function sellerLine(seller) {
  if (!seller || !seller.name) return '';
  const meta = [seller.verified ? '✔ ' + t('verified') : '', seller.swaps ? t('swaps', { n: seller.swaps }) : '', seller.rating ? '★ ' + seller.rating : '']
    .filter(Boolean).join(' · ');
  return `<div class="rc-seller"><span class="avatar">${esc(seller.name[0])}</span><span>${esc(seller.name)}<small>${meta}</small></span></div>`;
}

export const typeName = tt => esc(tx(tt?.name) || t('genericTicket'));

export const section = (inner, cls = '') => `<section class="section ${cls}"><div class="wrap">${inner}</div></section>`;
export const narrow = inner => `<section class="section"><div class="wrap narrow">${inner}</div></section>`;
