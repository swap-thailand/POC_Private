// App shell: header, router, delegated events and the 1-second timer loop.
// Screens are plain functions that return HTML strings; all data goes through `api`.

import { brand } from './config/brand.js';
import { settings, TEST_MODE } from './config/settings.js';
import { t, getLang, setLang } from './i18n/index.js';
import { esc, readFile, countdown } from './lib/format.js';
import { logoSvg, faviconHref } from './lib/logo.js';
import { api, initApi, ServiceError, errorKeys } from './services/index.js';
import { isExampleId } from './services/showcase.js';
import { homeView, eventGrid } from './views/home.js';
import { eventView, listingModal, waitlistModal } from './views/event.js';
import { ticketsView, disputeModal, checkoutModal } from './views/tickets.js';
import { sellView, sellSummary, listingsView } from './views/sell.js';
import { adminView, fileModal } from './views/admin.js';
import { testView, testBadge, pilotView, accountView, privacyView } from './views/tools.js';
import { partnersView } from './views/partners.js';
import { aboutView } from './views/about.js';

const $ = id => document.getElementById(id);
const state = {
  q: '', events: [], eventListings: [], currentEvent: null, adminTab: 'listings', admin: null,
  sell: { eventId: '', ticketTypeId: '', price: '', file: null, blob: null },
  slips: {}, payMethod: {}, evidence: null, confirmDelete: false, exported: '', menuOpen: false, partnerSent: false,
};
let user = null;
let sellerIntent = false;
const demoVerified = new Set();
const verified = () => !!user && (api.mode === 'sample' ? demoVerified.has(user.id) : user.verified === true);
let lastRoute = '';
let rendering = Promise.resolve();

// ---------- helpers ----------
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function openModal(html) {
  $('modal').innerHTML = `<button class="x" data-action="closeModal" aria-label="${t('close')}">✕</button><div class="modal-body">${html}</div>`;
  document.body.classList.add('modal-open');
  setTimeout(() => $('modal').querySelector('input,select,button:not(.x)')?.focus(), 50);
}
function closeModal() { document.body.classList.remove('modal-open'); }
const isAdmin = () => !!user?.roles?.includes('admin');
const testTools = () => TEST_MODE && api.capabilities.testTools;

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  return h && h !== 'page' ? h : lastRoute || 'home';
}

// ---------- logo ----------
// Built once and moved back into the header after each render, so its animation never restarts.
const logoEl = document.createElement('span');
logoEl.className = 'logo';
logoEl.innerHTML = logoSvg(brand.logo);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const syncLogoMotion = () => {
  const svg = logoEl.querySelector('svg');
  if (!svg?.pauseAnimations) return;
  if (motionQuery.matches) { svg.pauseAnimations(); svg.setCurrentTime(0); } else svg.unpauseAnimations();
};
syncLogoMotion();
motionQuery.addEventListener('change', syncLogoMotion);
{
  // Inline copy of public/favicon.svg, so single-file demos get the icon too.
  const icon = document.querySelector('link[rel=icon][type="image/svg+xml"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
  icon.type = 'image/svg+xml';
  icon.href = faviconHref();
}

// ---------- shell ----------
function header(r) {
  const on = name => (r === name || (name === 'home' && r.startsWith('event-')) ? 'on' : '');
  const links = [
    ['home', t('navEvents'), true], ['how', t('navHow'), true], // Sell is the black button in head-actions
    ['tickets', t('navTickets'), true], ['listings', t('navListings'), !!user], ['about', t('navAbout'), true], ['admin', t('navAdmin'), isAdmin()],
  ];
  return `<div class="wrap head-row">
    <a class="brand" href="#home" aria-label="${esc(brand.name)}"><span class="logo"></span><span class="word">${esc(brand.shortName)}</span></a>
    <nav class="nav" aria-label="Main">${links.filter(l => l[2]).map(([id, label]) => `<a href="#${id}" class="${on(id)} ${id === 'admin' ? 'role-link' : ''}">${label}</a>`).join('')}
      <a href="#partners" class="nav-partner ${on('partners')}">${t('partnerLink')}</a></nav>
    <div class="head-actions">
      <button class="lang" data-action="lang" aria-label="Language">${getLang() === 'en' ? 'ไทย' : 'EN'}</button>
      <a class="btn primary sm" href="#sell">${t('navSell')}</a><a class="lang" href="#account" aria-label="${t('accountTitle')}" style="display:inline-flex;padding:8px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></a>
      <a class="partner-cta ${r === 'partners' ? 'on' : ''}" href="#partners">${t('partnerLink')}</a>
      <button class="burger" data-action="burger" aria-label="${t('menu')}" aria-expanded="${state.menuOpen}"><span></span><span></span><span></span></button>
    </div></div>`;
}
function footer() {
  const social = brand.socials.map(x => `<a href="${x.url}" target="_blank" rel="noopener noreferrer" aria-label="JingTix on ${x.label}"><span aria-hidden="true">${x.emoji}</span> ${x.label}</a>`).join('');
  return `<div class="wrap foot-social"><b>${t('followUs')}</b>${social}</div><div class="wrap foot-row"><p>${t(api.mode === 'sample' ? 'footer' : 'footerConnected')}</p>
    <div class="foot-links"><a href="#about">${t('navAbout')}</a><a href="#partners">${t('partnerLink')}</a><a href="#privacy">${t('privacy')}</a>${isAdmin() ? `<a href="#pilot">${t('pilot')}</a>` : ''}
    ${testTools() ? `<a href="#test">${t('testTools')}</a><button data-action="resetDemo">${t('reset')}</button>` : ''}</div></div>`;
}

async function page(r) {
  const ctx = { api, user, state, verified: verified(), verificationPanel: () => verificationView(true) };
  if(r==='sell'){sellerIntent=true;if(!user)return accountView(ctx);if(!verified())return verificationView();}
  if(r==='verify')return user?verificationView():accountView(ctx);
  if (r === 'home' || r === 'how' || r === 'venues') return homeView(ctx);
  if (r.startsWith('event-')) return eventView(ctx, r.slice(6));
  const views = { sell: sellView, tickets: ticketsView, listings: listingsView, admin: adminView, test: testView, pilot: pilotView, account: accountView, privacy: privacyView, partners: partnersView, about: aboutView };
  return (views[r] || homeView)(ctx);
}

function verificationView(embedded=false){
 const th=getLang()==='th', tr=(en,thai)=>th?thai:en;
 const steps=[
 [tr('Email','อีเมล'),tr('Confirm your email','ยืนยันอีเมล'),'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 8L22 6"/>'],
 [tr('Phone number','หมายเลขโทรศัพท์'),tr('Verify with SMS','ยืนยันด้วย SMS'),'<rect x="7" y="2" width="10" height="20" rx="2"/>'],
 [tr('Government ID','บัตรประจำตัว'),tr('Passport or national ID','หนังสือเดินทางหรือบัตรประชาชน'),'<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M4 16q4-6 8 0M14 9h5M14 13h5"/>'] ];
 return `${embedded?'':'<section class="section"><div class="wrap narrow">' }<style>.jt-verify{max-width:760px;margin:auto;color:var(--ink)}.jt-verify h1{font-size:clamp(48px,9vw,100px);letter-spacing:-.06em;margin:12px 0}.jt-steps{list-style:none;padding:0;margin:36px 0;display:grid;gap:24px}.jt-steps li{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:16px;position:relative}.jt-num{border:2px solid currentColor;border-radius:50%;width:44px;height:44px;display:grid;place-items:center;font-weight:800}.jt-steps li:first-child .jt-num{background:#111;color:white}.jt-steps li:not(:last-child):after{content:'';position:absolute;left:21px;top:calc(50% + 26px);height:calc(50% + 16px);border-left:2px dashed currentColor}.jt-step{border:2px solid currentColor;border-radius:30px;padding:16px;display:flex;align-items:center;gap:16px}.jt-step svg{width:42px;height:42px}.jt-icon{background:#eee;color:#111;border-radius:16px;padding:12px;display:flex}.jt-step h3{font-size:clamp(18px,3vw,32px)}.jt-step p{opacity:.7}.jt-status{margin-left:auto;border:2px solid currentColor;border-radius:50%;width:28px;height:28px;flex-shrink:0}.jt-verify .wide{border-radius:999px;font-size:24px;padding:20px}.jt-note{text-align:center;margin-top:16px}@media(max-width:480px){.jt-step{padding:10px;gap:10px}.jt-icon{padding:7px}.jt-step svg{width:28px;height:28px}}</style><div class="jt-verify">${embedded?'':`<p class="kicker">${tr('VERIFY YOUR PROFILE','ยืนยันโปรไฟล์')}</p><h1>${tr('Get verified.','ยืนยันตัวตน')}</h1>`}<p>${tr('A quick, secure process to buy and sell tickets.','ยืนยันตัวตนเพื่อซื้อและขายตั๋วอย่างปลอดภัย')}</p><ol class="jt-steps">${steps.map(([title,desc,svg],i)=>`<li><span class="jt-num">${i+1}</span><div class="jt-step"><span class="jt-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span><div><h3>${title}</h3><p>${desc}</p></div><span class="jt-status">${i===0 && user?.emailVerified===true && !user.email?.endsWith("@privaterelay.appleid.com")?"✓":""}</span></div></li>`).join('')}</ol><button class="btn primary wide" data-action="startVerification" ${api.mode!=='sample'?'disabled':''}>${tr('Start verification','เริ่มยืนยันตัวตน')} ↘</button><p class="jt-note">♧ ${tr('Identity verification powered by Didit (planned)','วางแผนใช้ Didit')}</p><p class="jt-note mini">${tr('Demo only. No real identity data is collected.','ตัวอย่างเท่านั้น')}</p></div>${embedded?'':'</div></section>'}`;
}
function render() {
  rendering = rendering.then(doRender).catch(err => { console.error(err); toast(t('error')); });
  return rendering;
}
async function doRender() {
  const r = route();
  const changed = r !== lastRoute;
  lastRoute = r;
  user = await api.currentUser();
  document.documentElement.lang = getLang();
  document.title = `${brand.name} · ${brand.tagline[getLang()]}`;
  const html = await page(r);
  $('siteHead').innerHTML = header(r);
  $('siteHead').querySelector('.logo')?.replaceWith(logoEl);
  $('siteHead').classList.toggle('nav-open', state.menuOpen);
  $('page').innerHTML = html;
  $('siteFoot').innerHTML = footer();
  if (testTools()) {
    document.body.classList.add('test-mode');
    $('testBadge').className = 'test-badge';
    $('testBadge').innerHTML = testBadge(await api.listUsers(), user);
  }
  if (changed) {
    if (r === 'how' || r === 'venues') $(r)?.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
    if (r.startsWith('event-')) api.trackView(r.slice(6)).catch(() => {});
  }
}

// ---------- actions ----------
const reasonFor = id => document.getElementById('reason-' + id)?.value || '';

const actions = {
  closeModal,
  startVerification(){if(api.mode!=='sample'||!user)return;demoVerified.add(user.id);location.hash=sellerIntent?'#sell':'#account';return true;},
  burger() { state.menuOpen = !state.menuOpen; $('siteHead').classList.toggle('nav-open', state.menuOpen); },
  lang() { setLang(getLang() === 'en' ? 'th' : 'en'); return true; },
  scrollEvents() { $('events')?.scrollIntoView({ behavior: 'smooth' }); },
  lineToast() { toast(`LINE ${brand.lineHandle}`); },
  scrollTo(id) { $(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); $(id)?.querySelector('input')?.focus({ preventScroll: true }); },
  partnerAgain() { state.partnerSent = false; return true; },

  openListing(id) {
    const l = state.eventListings.find(x => x.id === id);
    if (l) openModal(listingModal(l, state.currentEvent, user));
  },
  async reserve(id) {
    await api.reserveListing(id);
    closeModal();
    location.hash = '#tickets';
    toast(t('holdLeft', { t: countdown(api.timing().holdMs) }));
  },
  async toggleInterest(id) {
    if (isExampleId(id)) return toast(t('exOnly'));
    if (!user) { location.hash = '#account'; return; }
    const r = await api.toggleInterest(id);
    toast(r.interested ? t('interestOnToast', { n: r.count.toLocaleString('en-US') }) : t('interestOffToast'));
    return true;
  },
  openWaitlist(id) {
    const ev = state.currentEvent?.id === id ? state.currentEvent : state.events.find(e => e.id === id);
    if (ev) openModal(waitlistModal(ev));
  },
  async submitSlip(id) {
    const slip = state.slips[id];
    if (!slip) return toast(t('fileError'));
    await api.submitPaymentSlip(id, slip);
    delete state.slips[id];
    return true;
  },
  payMethod(id, el) { state.payMethod[id] = el.dataset.method; return true; },
  async openCheckout(id, el) {
    const o = (await api.myOrders()).find(x => x.id === id);
    if (o) openModal(checkoutModal(o, el.dataset.method));
  },
  async payCard(id, el) {
    await api.payByCard(id, { method: el.dataset.method });
    closeModal();
    toast(t('cardPaid'));
    return true;
  },
  async declineCard(id, el) {
    try { await api.payByCard(id, { method: el.dataset.method, simulateDecline: true }); } finally { closeModal(); }
  },
  async cancelHold(id) { await api.cancelReservation(id); return true; },
  async confirmEntry(id) { await api.confirmEntry(id); toast(t('confirmedMsg')); return true; },
  openDispute(id) { state.evidence = null; openModal(disputeModal(id, null)); },

  async submitListing() {
    if(!verified()){location.hash='#sell';return true;}
    const s = state.sell;
    if (!s.file || !Number(s.price)) return toast(t('needAll'));
    const res = await api.submitListing({ eventId: s.eventId, ticketTypeId: s.ticketTypeId, price: Number(s.price), file: s.file, fileBlob: s.blob });
    toast(res?.status === 'approved' ? t('submittedLive') : t('submittedReview'));
    state.sell = { eventId: s.eventId, ticketTypeId: s.ticketTypeId, price: '', file: null, blob: null };
    location.hash = '#listings';
    return true;
  },
  async withdraw(id) { await api.withdrawListing(id); return true; },
  async markTransferred(id) { await api.markTransferred(id); return true; },

  adminTab(id) { state.adminTab = id; return true; },
  async viewFile(id) { openModal(fileModal(await api.getListingFile(id))); },
  async viewSlip(id) { openModal(fileModal(await api.getSlip(id))); },
  viewEvidence(id) { openModal(fileModal(state.admin?.disputes.find(o => o.id === id)?.dispute?.file)); },
  async approve(id) { await api.approveListing(id); return true; },
  async reject(id) { await api.rejectListing(id, reasonFor(id)); return true; },
  async ban(id) { await api.setBanned(id, true); return true; },
  async unban(id) { await api.setBanned(id, false); return true; },
  async markReceived(id) { await api.markPaymentReceived(id); return true; },
  async rejectPayment(id) { await api.rejectPayment(id, reasonFor(id)); return true; },
  async refund(id) { await api.refundOrder(id); return true; },
  async releasePayout(id) { await api.releasePayout(id); return true; },
  async notify(id) { const n = await api.notifyWaitlist(id); toast(t('notified', { n })); return true; },

  async actAs(id) { await api.actAs(id); state.confirmDelete = false; return true; },
  async toggleSetting(id, el) {
    await api.setTestSettings({ [id]: el.checked });
    toast(t('settingsSaved'));
    return true;
  },
  async runTimers() { await api.runTimers(); toast(t('timersRan')); return true; },
  async resetDemo() {
    await api.resetDemo();
    Object.assign(state, { slips: {}, evidence: null, exported: '', confirmDelete: false });
    state.sell = { eventId: '', ticketTypeId: '', price: '', file: null, blob: null };
    toast(t('resetDone'));
    return true;
  },

  async copyText(id) {
    const text = $(id)?.innerText || '';
    try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { selectText($(id)); }
  },
  async exportData() {
    state.exported = await api.exportData();
    await render();
    const box = $('exportBox');
    try { await navigator.clipboard.writeText(state.exported); toast(t('copied')); } catch { box?.select(); }
  },

  async signOut() { await api.signOut(); state.confirmDelete = false; location.hash = '#home'; return true; },
  askDelete() { state.confirmDelete = true; return true; },
  cancelDelete() { state.confirmDelete = false; return true; },
  async deleteAccount() { await api.deleteAccount(); state.confirmDelete = false; toast(t('deleted')); location.hash = '#home'; return true; },
};

function selectText(el) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

async function run(fn) {
  try {
    const rerender = await fn();
    if (rerender) await render();
  } catch (err) {
    if (err instanceof ServiceError) toast(t(errorKeys[err.code] || 'error'));
    else { console.error(err); toast(t('error')); }
  }
}

// ---------- forms ----------
const forms = {
  async waitlist(f, id) {
    await api.joinWaitlist(id, { channel: f.channel.value, contact: f.contact.value, consent: f.consent.checked });
    closeModal();
    toast(t('wlDone'));
  },
  async dispute(f, id) {
    await api.reportProblem(id, { reason: f.reason.value, note: f.note.value, file: state.evidence });
    closeModal();
    toast(t('reportSent'));
    return true;
  },
  async signIn(f) {
    const res = await api.signIn({ name: f.name?.value, email: f.email.value, lineId: f.lineId?.value, consent: f.consent.checked });
    if (res?.pendingEmailLink) return toast(t('linkSent'));
    location.hash = sellerIntent ? '#sell' : '#home';
    return true;
  },
  async addUser(f) {
    const roles = [...f.querySelectorAll('input[name=roles]:checked')].map(x => x.value);
    await api.addUser({ name: f.name.value, email: f.email.value, roles });
    toast(t('userAdded'));
    return true;
  },
  async createOrder(f) {
    const o = await api.createOrderFor(f.buyer.value, f.listing.value);
    toast(t('orderCreated', { name: o.buyer.name }));
    return true;
  },
  async partnerLead(f) {
    await api.submitPartnerLead({
      firstName: f.firstName.value, lastName: f.lastName.value, email: f.email.value, contact: f.contact.value,
      company: f.company.value, roles: [...f.querySelectorAll('input[name=roles]:checked')].map(x => x.value),
      city: f.city.value, volume: f.volume.value, ticketing: f.ticketing.value, message: f.message.value, consent: f.consent.checked,
    });
    state.partnerSent = true;
    toast(t('pt_thanksT'));
    await render();
    $('partnerForm')?.scrollIntoView({ block: 'start' });
  },
  async feedback(f) { await api.addFeedback({ channel: f.channel.value, text: f.text.value }); return true; },
};

// ---------- inputs ----------
async function onInput(el) {
  const kind = el.dataset.input;
  if (kind === 'search') { state.q = el.value; $('grid').innerHTML = eventGrid(state.events, state.q); }
  if (kind === 'sellEvent') { state.sell.eventId = el.value; state.sell.ticketTypeId = ''; await render(); }
  if (kind === 'sellType') { state.sell.ticketTypeId = el.value; $('sellSummary').innerHTML = sellSummary(state); }
  if (kind === 'sellPrice') { state.sell.price = el.value; $('sellSummary').innerHTML = sellSummary(state); }
  if (kind === 'actAs') await run(() => actions.actAs(el.value));
}

async function onFile(el) {
  const file = el.files?.[0];
  if (!file) return;
  if (!settings.upload.types.includes(file.type) || file.size > settings.upload.maxBytes || !file.size) {
    el.value = '';
    return toast(t('fileError'));
  }
  const meta = await readFile(file);
  const id = el.dataset.file;
  if (id === 'ticketFile') { state.sell.file = meta; state.sell.blob = file; }
  else if (id === 'evidence') state.evidence = meta;
  else if (id.startsWith('slip-')) state.slips[id.slice(5)] = meta;
  const label = el.closest('.file-drop');
  label?.classList.add('done');
  const text = label?.querySelector('.fd-text');
  if (text) text.textContent = '✔ ' + meta.name;
}

// ---------- events ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.closest('.nav a') && state.menuOpen) actions.burger();
    return;
  }
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') e.preventDefault();
  run(() => fn(el.dataset.id, el));
});
// Shared chart tooltip: any element with data-tip shows it on hover or keyboard focus.
const tip = Object.assign(document.createElement('div'), { className: 'ch-tip', role: 'status' });
document.body.appendChild(tip);
const showTip = (el, x, y) => { tip.textContent = el.dataset.tip; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on'); };
document.addEventListener('pointermove', e => {
  const el = e.target.closest?.('[data-tip]');
  if (el) showTip(el, e.clientX, e.clientY); else tip.classList.remove('on');
});
document.addEventListener('focusin', e => {
  const el = e.target.closest?.('[data-tip]');
  if (!el) return tip.classList.remove('on');
  const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top);
});
document.addEventListener('focusout', () => tip.classList.remove('on'));
document.addEventListener('scroll', () => tip.classList.remove('on'), { passive: true });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  const card = e.target.closest?.('[role=button][data-action]');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); card.click(); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  run(() => forms[f.dataset.form](f, f.dataset.id));
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset?.input && el.tagName === 'INPUT') onInput(el);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset?.file) onFile(el);
  else if (el.dataset?.input && el.tagName === 'SELECT') onInput(el);
});
$('modalBg').addEventListener('click', closeModal);
window.addEventListener('hashchange', () => {
  if (location.hash === '#page') return $('page').focus();
  state.menuOpen = false;
  closeModal();
  render();
});

// Countdowns tick every second; if a hold expires or an order auto-confirms, re-render.
setInterval(() => {
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const left = new Date(el.dataset.countdown) - Date.now();
    const value = countdown(left);
    el.innerHTML = t(el.dataset.label, { t: el.dataset.label === 'autoConfirmIn' ? `<b>${value}</b>` : value });
  });
  if (api.tick?.()) render();
}, 1000);

(async () => {
  await initApi();
  if (api.subscribe && api.mode !== 'sample') api.subscribe(render);
  await render();
})();
