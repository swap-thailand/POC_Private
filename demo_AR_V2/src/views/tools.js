import { t, getLang } from '../i18n/index.js';
import { settings, TEST_MODE } from '../config/settings.js';
import { brand } from '../config/brand.js';
import { esc, baht, dateTime } from '../lib/format.js';
import { section, narrow, typeName } from './components.js';

const roleOf = u => (u.roles.includes('admin') ? 'admin' : u.roles.includes('seller') ? 'seller' : 'buyer');

export function testBadge(users, user) {
  return `<span>${t('testBanner')}</span>
    <label class="sr-only" for="actAsSel">${t('switchUser')}</label>
    <select id="actAsSel" data-input="actAs" aria-label="${t('switchUser')}">
      <option value="">— ${t('signIn')} —</option>
      ${users.map(u => `<option value="${esc(u.id)}" ${u.id === user?.id ? 'selected' : ''}>${esc(u.name)} · ${t('role_' + roleOf(u))}</option>`).join('')}
    </select><a href="#test">${t('testTools')}</a>`;
}

export async function testView({ api }) {
  if (!TEST_MODE || !api.capabilities.testTools) return narrow(`<h1 class="page-title">${t('testTitle')}</h1><p class="notice">${t('testOnly')}</p>`);
  const [users, ts, live] = await Promise.all([api.listUsers(), api.getTestSettings(), api.liveListingsForTest()]);
  return section(`<h1 class="page-title">${t('testTitle')}</h1>
  <div class="test-grid">
    <div class="tcard"><h3>${t('users')}</h3><div class="users-list">${users.map(u => `<div><span>${esc(u.name)} · ${t('role_' + roleOf(u))}${u.banned ? ' · ' + t('banned') : ''}</span>
      <button class="alert-link" data-action="actAs" data-id="${esc(u.id)}">${t('switchUser')}</button></div>`).join('')}</div></div>

    <form class="tcard form" data-form="addUser"><h3>${t('addUser')}</h3>
      <label>${t('name')}<input type="text" name="name" required></label>
      <label>${t('email')}<input type="email" name="email" required></label>
      <fieldset class="field"><legend>${t('roleLabel')}</legend>
        ${['buyer', 'seller', 'admin'].map(r => `<label class="check"><input type="checkbox" name="roles" value="${r}" ${r === 'buyer' ? 'checked' : ''}> ${t('role_' + r)}</label>`).join('')}</fieldset>
      <button class="btn primary" type="submit">${t('addUserBtn')}</button></form>

    <form class="tcard form" data-form="createOrder"><h3>${t('createOrder')}</h3>
      <label>${t('pickBuyer')}<select name="buyer">${users.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select></label>
      <label>${t('pickListing')}<select name="listing">${live.map(l => `<option value="${esc(l.id)}">${esc(l.event.name)} · ${typeName(l.ticketType)} · ${baht(l.total)} · ${esc(l.seller.name)}</option>`).join('')}</select></label>
      <button class="btn primary" type="submit" ${live.length ? '' : 'disabled'}>${t('createOrderBtn')}</button></form>

    <div class="tcard"><h3>${t('testTitle')}</h3>
      <label class="toggle"><input type="checkbox" data-action="toggleSetting" data-id="skipApproval" ${ts.skipApproval ? 'checked' : ''}> ${t('skipApproval')}</label>
      <label class="toggle"><input type="checkbox" data-action="toggleSetting" data-id="fastTimers" ${ts.fastTimers ? 'checked' : ''}> ${t('fastTimers', { hold: settings.test.fastHoldSeconds, confirm: settings.test.fastConfirmSeconds })}</label>
      <div class="btn-row"><button class="btn ghost" data-action="runTimers">${t('runTimers')}</button>
      <button class="btn ghost" data-action="resetDemo">${t('resetSeed')}</button></div></div>
  </div>`);
}

export async function pilotView({ api, user, state }) {
  if (!user?.roles?.includes('admin') || !api.capabilities.admin) return narrow(`<h1 class="page-title">${t('pilotTitle')}</h1><p class="notice">${t('adminOnly')}</p>`);
  const d = await api.pilotData();
  const c = d.counts;
  const card = (title, body) => `<div class="tcard"><h3>${t(title)}</h3><p>${t(body)}</p></div>`;
  return section(`<h1 class="page-title">${t('pilotTitle')}</h1>
  <h4 class="mini">${t('funnel')}</h4>
  <div class="funnel">${[['views', 'cViews'], ['holds', 'cHolds'], ['paid', 'cPaid'], ['confirmed', 'cConfirmed']].map(([k, l]) => `<div><b>${c[k]}</b><span>${t(l)}</span></div>`).join('')}</div>
  <div class="funnel">${[['listings', 'cListings'], ['waitlist', 'cWaitlist'], ['partners', 'cPartners']].map(([k, l]) => `<div><b>${c[k]}</b><span>${t(l)}</span></div>`).join('')}<div><b>${c.holds ? Math.round((c.confirmed / c.holds) * 100) : 0}%</b><span>${t('cHolds')} → ${t('cConfirmed')}</span></div></div>
  <div class="test-grid">
    ${card('recruitT', 'recruitB')}${card('testT', 'testB')}
    <div class="tcard"><h3>${t('outreachT')}</h3><p id="outreachText">${t('outreachB')}</p><button class="btn ghost sm" data-action="copyText" data-id="outreachText">${t('copy')}</button></div>
    <form class="tcard form" data-form="feedback"><h3>${t('feedback')}</h3>
      <label>${t('channel')}<select name="channel"><option>LINE</option><option>Instagram</option><option>Facebook</option><option>In person</option></select></label>
      <label>${t('note')}<textarea name="text" rows="3" required></textarea></label>
      <button class="btn primary" type="submit">${t('logFb')}</button>
      ${d.feedback.length ? `<div class="audit">${d.feedback.slice(0, 8).map(f => `<div>${esc(f.text)}<br><span class="mini">${esc(f.channel)} · ${esc(dateTime(f.at, getLang()))}</span></div>`).join('')}</div>` : ''}</form>
    <div class="tcard"><h3>${t('actLog')}</h3><div class="audit">${d.activity.slice(0, 20).map(a => `<div>${t(a.type)} <span class="mini">· ${esc(dateTime(a.at, getLang()))}</span></div>`).join('') || `<p class="muted">${t('noAct')}</p>`}</div></div>
    <div class="tcard"><h3>${t('exportBtn')}</h3><button class="btn ghost" data-action="exportData">${t('exportBtn')}</button>
      ${state.exported ? `<textarea id="exportBox" rows="8" readonly style="width:100%;font:12px monospace">${esc(state.exported)}</textarea>` : ''}</div>
  </div>`);
}

export async function accountView({ api, user, state }) {
  if (user) {
    return narrow(`<h1 class="page-title">${t('accountTitle')}</h1>
      <p>${t('signedInAs', { name: `<b>${esc(user.name)}</b>` })}</p><p class="mini">${esc(user.email)} · ${user.roles.map(r => t('role_' + r)).join(', ')}</p>
      <div class="btn-row"><button class="btn ghost" data-action="signOut">${t('signOut')}</button></div>
      <h4>${t('privacyTitle')}</h4><p class="mini">${t('deleteWarn')}</p>
      ${state.confirmDelete
        ? `<div class="btn-row"><button class="btn primary" data-action="deleteAccount">${t('deleteConfirm')}</button><button class="btn ghost" data-action="cancelDelete">${t('cancel')}</button></div>`
        : `<button class="btn ghost" data-action="askDelete">${t('deleteAccount')}</button>`}`);
  }
  const sample = api.mode === 'sample';
  return narrow(`<h1 class="page-title">${t('signInTitle')}</h1>
    <form class="form" data-form="signIn">
      ${sample ? `<label>${t('name')}<input type="text" name="name" autocomplete="name"></label>` : ''}
      <label>${t('email')}<input type="email" name="email" required autocomplete="email"></label>
      ${sample ? `<label>${t('lineId')}<input type="text" name="lineId"></label>` : ''}
      <label class="check"><input type="checkbox" name="consent"> <span>${t('consentTerms')} <a href="#privacy">${t('privacy')}</a></span></label>
      <button class="btn primary wide" type="submit">${sample ? t('signInBtn') : t('sendLink')}</button>
      ${sample ? `<p class="mini">${t('demoSignInNote')}</p>` : ''}
    </form>`);
}

export function privacyView() {
  return narrow(`<h1 class="page-title">${t('privacyTitle')}</h1><p>${t('privacyBody')}</p>
    <p class="mini" style="margin-top:16px">${esc(brand.supportEmail)} · ${esc(brand.lineHandle)}</p>`);
}
