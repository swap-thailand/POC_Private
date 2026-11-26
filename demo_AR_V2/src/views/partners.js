import { t, getLang } from '../i18n/index.js';
import { brand } from '../config/brand.js';
import { esc, dateTime } from '../lib/format.js';

const ROLES = ['club', 'bar', 'festival', 'promoter', 'organiser', 'group', 'artist', 'ticketing', 'other'];
const CITIES = ['bangkok', 'phuket', 'pattaya', 'chiangmai', 'islands', 'other'];
const VOLUMES = ['v1', 'v2', 'v3', 'v4', 'v5'];

const tag = live => `<span class="pt-tag ${live ? 'live' : ''}">${t(live ? 'pt_tagLive' : 'pt_tagPlanned')}</span>`;
const bullet = (key, live) => `<li>${tag(live)}<span>${t(key)}</span></li>`;

// Illustrative numbers only, clearly labelled as such.
function sampleDashboard() {
  const tiles = [['64', 'pt_dSwapped'], ['212', 'pt_dWaitlist'], ['38m', 'pt_dSpeed'], ['0', 'pt_dFakes']];
  const bars = [['GA', 72], ['NYE', 54], ['All Night', 31]];
  return `<div class="pt-dash" aria-label="${t('pt_dashLabel')}">
    <div class="pt-dash-head"><b>White Party Bangkok</b><span>${t('pt_sample')}</span></div>
    <div class="pt-tiles">${tiles.map(([n, k]) => `<div><b>${n}</b><span>${t(k)}</span></div>`).join('')}</div>
    <h4>${t('pt_dDemand')}</h4>
    <div class="pt-bars">${bars.map(([l, v]) => `<div><span>${l}</span><i style="--w:${v}%"></i><b>${v}</b></div>`).join('')}</div>
  </div>`;
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

<section class="section pt-dark"><div class="wrap"><div class="sec-head"><h2>${t('pt_probTitle')}</h2></div>
  <div class="pt-cards">${[1, 2, 3].map(i => `<div class="pt-card"><h3>${t(`pt_prob${i}T`)}</h3><p>${t(`pt_prob${i}B`)}</p></div>`).join('')}</div>
</div></section>

<section class="section"><div class="wrap">
  ${feature(1, [['pt_f1a', true], ['pt_f1b', true], ['pt_f1c', true], ['pt_f1d', true]])}
  ${feature(2, [['pt_f2a', true], ['pt_f2b', true], ['pt_f2c', false]], true)}
  ${feature(3, [['pt_f3a', false], ['pt_f3b', false], ['pt_f3c', false], ['pt_f3d', true]])}
  ${feature(4, [['pt_f4a', true], ['pt_f4b', false], ['pt_f4c', true], ['pt_f4d', false]], true)}
</div></section>

<section class="section pt-soft"><div class="wrap"><div class="sec-head"><h2>${t('pt_dataTitle')}</h2></div>
  <p class="lead" style="margin-bottom:18px">${t('pt_dataSub')}</p>
  <div class="pt-table" role="table">
    <div class="pt-tr pt-th" role="row"><span role="columnheader">${t('pt_dataCol1')}</span><span role="columnheader">${t('pt_dataCol2')}</span></div>
    ${[1, 2, 3, 4, 5].map(i => `<div class="pt-tr" role="row"><span role="cell"><b>${t(`pt_d${i}T`)}</b></span><span role="cell">${t(`pt_d${i}B`)}</span></div>`).join('')}
  </div>
  <p class="mini" style="margin-top:12px">${t('pt_pdpa')}</p>
</div></section>

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
