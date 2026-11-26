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

export async function accountView({ api, user, state, verified, verificationPanel }) {
  const tr=(en,th)=>getLang()==='th'?th:en;
  if (user) {
    const relay=user.email?.endsWith('@privaterelay.appleid.com');
    const row=(icon,label,value)=>`<div class="jt-account-row"><span aria-hidden="true">${icon}</span><div><b>${label}</b><p>${value}</p></div></div>`;
    return `<section class="section"><div class="wrap"><style>
    .jt-account-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}.jt-account-card{border:1.5px solid currentColor;border-radius:28px;padding:26px;margin-bottom:20px}.jt-account-card h2{font-size:32px;letter-spacing:-.04em;margin-bottom:20px}.jt-account-row{display:flex;align-items:center;gap:16px;border-top:1px solid #ddd;padding:16px 0}.jt-account-row p{margin:4px 0;overflow-wrap:anywhere}.jt-account-row>span{font-size:24px}.jt-account-card .jt-steps{margin:24px 0}.jt-account-card .jt-step h3{font-size:22px}.jt-account-card .jt-step svg{width:30px;height:30px}.jt-complete{text-align:center;padding:32px 0}.jt-complete h3{font-size:42px;line-height:1}.jt-complete-icon{display:grid;place-items:center;background:#d9f5d9;border-radius:50%;width:90px;height:90px;margin:0 auto 24px;font-size:46px;color:#111}@media(max-width:800px){.jt-account-grid{grid-template-columns:1fr}}
    </style><h1 class="page-title" style="font-size:clamp(52px,8vw,100px);letter-spacing:-.06em">${tr('Account','บัญชี')}</h1><p style="margin-bottom:28px">${tr('Manage your account, verification and settings.','จัดการบัญชี การยืนยันตัวตน และการตั้งค่า')}</p><div class="jt-account-grid"><div><div class="jt-account-card"><h2>${esc(user.name)}</h2>
    ${row('✉',tr('Email','อีเมล'),relay?tr('Contact email required','กรุณาระบุอีเมลติดต่อ'):esc(user.email||''))}
    ${row('☎',tr('Phone','โทรศัพท์'),esc(user.phone||tr('Not verified','ยังไม่ยืนยัน')))}
    <div class="jt-account-row"><span>◎</span><div style="flex:1"><b>${tr('Language','ภาษา')}</b></div><button class="btn ghost sm" data-action="lang">${getLang()==='th'?'ไทย':'English'} ↕</button></div></div>
    <div class="jt-account-card"><h2>${tr('Account settings','ตั้งค่าบัญชี')}</h2>
    ${row('⚿',tr('Password','รหัสผ่าน'),tr('Managed by your sign-in provider','จัดการโดยผู้ให้บริการเข้าสู่ระบบ'))}
    ${row('♧',tr('Notifications','การแจ้งเตือน'),tr('Coming soon','เร็วๆ นี้'))}
    ${row('▤',tr('Privacy & data','ความเป็นส่วนตัวและข้อมูล'),'<a href="#privacy">'+t('privacyTitle')+'</a>')}
    <p class="mini">${t('deleteWarn')}</p>
    ${state.confirmDelete?`<div class="btn-row"><button class="btn primary" data-action="deleteAccount">${t('deleteConfirm')}</button><button class="btn ghost" data-action="cancelDelete">${t('cancel')}</button></div>`:`<button class="btn ghost" data-action="askDelete">${t('deleteAccount')}</button>`}
    <button class="btn ghost" data-action="signOut">${t('signOut')}</button></div></div>
    <div class="jt-account-card"><h2>${tr('Verification','การยืนยันตัวตน')}</h2>${verified?`<div class="jt-complete"><div class="jt-complete-icon">✓</div><h3>${tr('Verification completed.','ยืนยันตัวตนสำเร็จ')}</h3><p>${tr('Your account is verified.','บัญชีของคุณได้รับการยืนยันแล้ว')}</p></div>${['Email','Phone','Government ID'].map((v,i)=>row('✓',tr(v,['อีเมล','โทรศัพท์','บัตรประจำตัว'][i]),tr('Verified','ยืนยันแล้ว'))).join('')}${api.mode==='sample'?'<p class="mini">Simulated verification</p>':''}`:verificationPanel()}</div></div></div></section>`;
  }
  const sample = api.mode === 'sample';
  return narrow(`<h1 class="page-title">${t('signInTitle')}</h1>
    <form class="form" data-form="signIn">
      ${sample ? `<p class="mini">Google OAuth is not configured in this local demo. Use a sample email to test the verification journey.</p>` : ""}
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
