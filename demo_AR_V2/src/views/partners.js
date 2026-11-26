import { t, getLang } from '../i18n/index.js';
import { brand } from '../config/brand.js';
import { esc, dateTime, baht } from '../lib/format.js';
import { settings } from '../config/settings.js';
import { buyerFee, sellerFee } from '../lib/fees.js';
import { columns, rowBars, stacked } from './charts.js';
import { heart } from './components.js';

const ROLES = ['club', 'bar', 'festival', 'promoter', 'organiser', 'group', 'artist', 'ticketing', 'other'];
const CITIES = ['bangkok', 'phuket', 'pattaya', 'chiangmai', 'islands', 'other'];
const VOLUMES = ['v1', 'v2', 'v3', 'v4', 'v5'];

const tag = live => `<span class="pt-tag ${live ? 'live' : ''}">${t(live ? 'pt_tagLive' : 'pt_tagPlanned')}</span>`;
const bullet = (key, live) => `<li>${tag(live)}<span>${t(key)}</span></li>`;

// ---------- sample partner data (White Party Bangkok) ----------
// Illustrative numbers, labelled as samples on the page. The willingness-to-pay curve follows the
// buyer-response assumption in the JingTix financial model until pilot data replaces it.
const SAMPLE = {
  swapsByDay: [0, 1, 0, 1, 2, 1, 2, 2, 1, 3, 2, 3, 4, 3, 4, 5, 6, 7, 8, 6, 3], // 21 days, last = event day
  finalDays: 5,
  priceBands: [['pt_bFace', 22, 0], ['pt_b5', 15, 0.03], ['pt_b10', 15, 0.08], ['pt_b15', 8, 0.13], ['pt_b20', 4, 0.18]], // [label, swaps, mid markup]
  soldIn24h: [91, 87, 79, 58, 41], // % of listings sold within 24 hours, same bands
  channels: [['pt_chQr', 34], ['pt_chLine', 27], ['pt_chIg', 21], ['pt_chFriends', 18]],
  avgFace: 3300, speed: '38m',
  exampleFace: 3200,
};
const total = a => a.reduce((x, y) => x + y, 0);
const pctOf = (a, b) => Math.round((a / b) * 100);

function sampleStats() {
  const swaps = total(SAMPLE.swapsByDay);
  const markupSum = SAMPLE.priceBands.reduce((a, [, n, m]) => a + n * m, 0);
  const avgMarkup = markupSum / swaps;
  const markupBaht = markupSum * SAMPLE.avgFace;
  return { swaps, avgMarkup, markupBaht };
}

function swapsChart(height) {
  const d = SAMPLE.swapsByDay, n = d.length;
  return columns({
    title: t('pt_c1T'), height,
    data: d.map((v, i) => {
      const out = n - 1 - i, label = out ? t('pt_daysOut', { n: out }) : t('pt_eventDay');
      return { label, value: v, strong: i >= n - SAMPLE.finalDays, tip: `${label}: ${t('pt_swapsN', { n: v })}` };
    }),
    ticks: [0, Math.floor(n / 2), n - 1],
  });
}

// Hero card: headline numbers plus the swaps chart in miniature.
function sampleDashboard() {
  const st = sampleStats();
  const tiles = [[String(st.swaps), 'pt_dSwapped'], [`+${Math.round(st.avgMarkup * 100)}%`, 'pt_dMarkup'], [SAMPLE.speed, 'pt_dSpeed'], ['100%', 'pt_dVerified']];
  return `<div class="pt-dash" aria-label="${t('pt_dashLabel')}">
    <div class="pt-dash-head"><b>White Party Bangkok</b><span>${t('pt_sample')}</span></div>
    <div class="pt-tiles">${tiles.map(([n, k]) => `<div><b>${n}</b><span>${t(k)}</span></div>`).join('')}</div>
    <p class="mini pt-int">${heart(true)} ${t('pt_dInterested', { n: '1,240' })}</p>
    <h4>${t('pt_dSwapsDaily')}</h4>${swapsChart(90)}
  </div>`;
}

// The four dashboard charts, each with a one-line takeaway.
function dashboardCharts() {
  const st = sampleStats(), d = SAMPLE.swapsByDay;
  const late = total(d.slice(-SAMPLE.finalDays));
  const bands = SAMPLE.priceBands;
  const over15 = bands[bands.length - 1][1]; // the +16 to 20% band
  const chTotal = total(SAMPLE.channels.map(c => c[1]));
  const card = (title, body, insight, wide) => `<div class="pt-chart ${wide ? 'wide' : ''}"><h3>${title}</h3>${body}<p class="pt-insight">${insight}</p></div>`;
  return `<div class="pt-charts">
    ${card(t('pt_c1T'), swapsChart(180), t('pt_c1I', { p: pctOf(late, st.swaps), d: SAMPLE.finalDays }), true)}
    ${card(t('pt_c2T'), rowBars({ title: t('pt_c2T'), rows: bands.map(([k, n], i) => ({ label: t(k), value: n, display: t('pt_swapsN', { n }), strong: i === 0 })) }),
      t('pt_c2I', { p: pctOf(over15, st.swaps), avg: Math.round(st.avgMarkup * 100) }))}
    ${card(t('pt_c3T'), rowBars({ title: t('pt_c3T'), max: 100, rows: bands.map(([k], i) => ({ label: t(k), value: SAMPLE.soldIn24h[i], display: SAMPLE.soldIn24h[i] + '%', strong: SAMPLE.soldIn24h[i] >= 50 })) }),
      t('pt_c3I'))}
    ${card(t('pt_c4T'), rowBars({ title: t('pt_c4T'), rows: SAMPLE.channels.map(([k, v], i) => ({ label: t(k), value: v, display: v + '%', strong: i < 2 })) }),
      t('pt_c4I', { p: pctOf(SAMPLE.channels[0][1] + SAMPLE.channels[1][1], chTotal) }))}
  </div>`;
}

// Where the money goes on one ticket at face value, +10% and +20%, from the live fee settings.
function pricingSection() {
  const face = SAMPLE.exampleFace, max = settings.pricing.maxMarkup;
  const steps = [0, max / 2, max].map(m => {
    const list = Math.round(face * (1 + m)), bf = buyerFee(list), sf = sellerFee(list);
    return { m, list, buyer: list + bf, seller: list - sf, fees: bf + sf };
  });
  const top = steps[steps.length - 1];
  const share = Math.round(sampleStats().markupBaht * 0.5 / 100) * 100;
  const chart = stacked({
    title: t('pt_stackT', { face: baht(face) }),
    legend: [{ cls: 'ch-ink', label: t('pt_sSeller') }, { cls: 'ch-mute', label: t('pt_sFees') }],
    rows: steps.map(s => ({
      label: s.m ? t('pt_rowUp', { p: Math.round(s.m * 100) }) : t('pt_rowFace'),
      total: baht(s.buyer),
      segs: [{ value: s.seller, cls: 'ch-ink', tip: `${t('pt_sSeller')}: ${baht(s.seller)}` },
        { value: s.fees, cls: 'ch-mute', tip: `${t('pt_sFees')}: ${baht(s.fees)}` }],
    })),
  });
  const pct = v => Math.round(v * 100);
  const points = [[t('pt_pr1', { p: pct(max) }), true], [t('pt_pr2', { p: pct(settings.pricing.buyerPercent) }), true],
    [t('pt_pr3', { p: pct(settings.pricing.sellerPercent) }), true], [t('pt_pr4'), true], [t('pt_pr5', { x: baht(share) }), false]];
  return `<section class="section pt-pricing"><div class="wrap pt-price-grid">
    <div><span class="kicker">${t('pt_priceKicker')}</span><h2>${t('pt_priceTitle', { p: pct(max) })}</h2><p class="lead">${t('pt_priceSub', { p: pct(max), face: baht(face) })}</p>
      <ul class="pt-list">${points.map(([txt, live]) => `<li>${tag(live)}<span>${txt}</span></li>`).join('')}</ul></div>
    <div class="pt-chart"><h3>${t('pt_stackT', { face: baht(face) })}</h3>${chart}
      <p class="pt-insight">${t('pt_stackI', { buyer: baht(top.buyer), seller: baht(top.seller), extra: baht(top.seller - face) })}</p></div>
  </div></section>`;
}

export function partnersView({ state }) {
  const sent = state.partnerSent;
  const feature = (n, items, flip) => `<div class="pt-feature ${flip ? 'flip' : ''}">
      <div><span class="kicker">0${n}</span><h3>${t(`pt_f${n}T`)}</h3><p class="lead">${t(`pt_f${n}B`)}</p></div>
      <ul class="pt-list">${items.map(([k, live]) => bullet(k, live)).join('')}</ul></div>`;

  return `
<section class="hero pt-hero"><div class="wrap hero-grid">
  <div class="hero-copy"><span class="kicker">${t('pt_kicker')}</span><h1>${t('pt_title')}</h1><p class="lead">${t('pt_sub')}</p>
    <div class="btn-row"><button class="btn primary" data-action="scrollTo" data-id="partnerForm">${t('pt_ctaForm')}</button>
    <button class="btn line" data-action="lineToast">${t('pt_ctaLine')}</button></div></div>
  <div class="hero-aside">${sampleDashboard()}<p class="mini" style="margin-top:8px">${t('pt_sampleNote')}</p></div>
</div></section>

<section class="pt-pilot"><div class="wrap"><p><b>${t('pt_pilotT')}</b> ${t('pt_pilotB')}</p>
  <div class="pt-slots">${[1, 2, 3, 4].map(() => `<span>${t('pt_slot')}</span>`).join('')}</div></div></section>

<section class="section"><div class="wrap"><div class="sec-head"><h2>${t('pt_whyTitle')}</h2></div>
  <div class="pt-cards">${[1, 2, 3].map(i => `<div class="pt-card"><span class="pt-num">${i}</span><h3>${t(`pt_why${i}T`)}</h3><p>${t(`pt_why${i}B`)}</p></div>`).join('')}</div>
</div></section>
<section class="section"><div class="wrap">
  ${feature(1, [['pt_f1a', true], ['pt_f1b', true], ['pt_f1c', true], ['pt_f1d', true]])}
  ${feature(2, [['pt_f2a', true], ['pt_f2b', true], ['pt_f2c', false]], true)}
  ${feature(3, [['pt_f3a', false], ['pt_f3b', false], ['pt_f3c', false], ['pt_f3d', true], ['pt_f3e', true]])}
  ${feature(4, [['pt_f4a', true], ['pt_f4b', false], ['pt_f4c', true], ['pt_f4d', false]], true)}
</div></section>

<section class="section pt-soft"><div class="wrap"><div class="sec-head"><h2>${t('pt_dataTitle')}</h2></div>
  <p class="lead" style="margin-bottom:22px">${t('pt_dataSub')}</p>
  ${dashboardCharts()}
  <p class="mini" style="margin-top:14px">${t('pt_modelNote')} ${t('pt_pdpa')}</p>
</div></section>

${pricingSection()}

<section class="section"><div class="wrap"><div class="sec-head"><h2>${t('pt_promiseTitle')}</h2></div>
  <ul class="pt-promises">${[1, 2, 3, 4, 5, 6].map(i => `<li><b>${t(`pt_p${i}T`)}</b><span>${t(`pt_p${i}B`)}</span></li>`).join('')}</ul>
</div></section>

<section class="section how"><div class="wrap"><div class="sec-head"><h2>${t('pt_stepsTitle')}</h2></div>
  <div class="how-col"><ol>${[1, 2, 3].map(i => `<li><b>${i}</b><span><strong>${t(`pt_s${i}T`)}</strong> ${t(`pt_s${i}B`)}</span></li>`).join('')}</ol></div>
</div></section>

<section class="section pt-form-wrap" id="partnerForm"><div class="wrap pt-form-grid">
  <div><span class="kicker">${t('pt_formKicker')}</span><h2>${t('pt_formTitle')}</h2><p class="lead">${t('pt_formSub')}</p>
    <p class="mini" style="margin-top:14px">LINE ${esc(brand.lineHandle)} · ${esc(brand.supportEmail)}</p></div>
  ${sent ? `<div class="notice ok pt-thanks"><b>${t('pt_thanksT')}</b><p>${t('pt_thanksB')}</p>
      <button class="btn ghost sm" data-action="partnerAgain">${t('pt_another')}</button></div>` : `
  <form class="form pt-form" data-form="partnerLead" novalidate>
    <div class="pt-two"><label>${t('pt_first')}<input type="text" name="firstName" required autocomplete="given-name"></label>
      <label>${t('pt_last')}<input type="text" name="lastName" autocomplete="family-name"></label></div>
    <div class="pt-two"><label>${t('pt_email')}<input type="email" name="email" required autocomplete="email"></label>
      <label>${t('pt_phone')}<input type="text" name="contact" autocomplete="tel"></label></div>
    <label>${t('pt_company')}<input type="text" name="company" required autocomplete="organization"></label>
    <fieldset class="field"><legend>${t('pt_roles')}</legend><div class="pt-checks">
      ${ROLES.map(r => `<label class="check"><input type="checkbox" name="roles" value="${r}"> ${t('pt_r_' + r)}</label>`).join('')}</div></fieldset>
    <div class="pt-two"><label>${t('pt_city')}<select name="city">${CITIES.map(c => `<option value="${c}">${t('pt_c_' + c)}</option>`).join('')}</select></label>
      <label>${t('pt_volume')}<select name="volume">${VOLUMES.map(v => `<option value="${v}">${t('pt_' + v)}</option>`).join('')}</select></label></div>
    <label>${t('pt_ticketing')}<input type="text" name="ticketing" placeholder="${t('pt_ticketingPh')}"></label>
    <label>${t('pt_message')}<textarea name="message" rows="3"></textarea></label>
    <label class="check"><input type="checkbox" name="consent"> <span>${t('pt_consent')} <a href="#privacy">${t('privacy')}</a></span></label>
    <button class="btn primary wide" type="submit">${t('pt_submit')}</button>
  </form>`}
</div></section>`;
}

export function partnerLeadRows(leads) {
  if (!leads.length) return `<p class="muted" style="padding:16px 0">${t('queueEmpty')}</p>`;
  return leads.map(l => `<div class="arow"><div>
    <h3>${esc(l.company)} · ${esc(l.firstName)} ${esc(l.lastName)}</h3>
    <p>${l.roles.map(r => t('pt_r_' + r)).join(', ') || '—'} · ${t('pt_c_' + l.city)} · ${t('pt_' + l.volume)}${l.ticketing ? ' · ' + esc(l.ticketing) : ''}</p>
    <p>${esc(l.email)}${l.contact ? ' · ' + esc(l.contact) : ''}</p>${l.message ? `<p>“${esc(l.message)}”</p>` : ''}
    <p class="mini">${esc(dateTime(l.createdAt, getLang()))}</p></div></div>`).join('');
}
