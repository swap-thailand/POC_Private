// App shell: header, router, delegated events and the 1-second timer loop.
// Screens are plain functions that return HTML strings; all data goes through `api`.

import { brand } from './config/brand.js';
import { settings, TEST_MODE } from './config/settings.js';
import { t, getLang, setLang } from './i18n/index.js';
import { esc, readFile, countdown } from './lib/format.js';
import { api, initApi, ServiceError, errorKeys } from './services/index.js';
import { homeView, eventGrid } from './views/home.js';
import { eventView, listingModal, waitlistModal } from './views/event.js';
import { ticketsView, disputeModal, checkoutModal } from './views/tickets.js';
import { sellView, sellSummary, listingsView } from './views/sell.js';
import { adminView, fileModal } from './views/admin.js';
import { testView, testBadge, pilotView, accountView, privacyView } from './views/tools.js';
import { partnersView } from './views/partners.js';

const $ = id => document.getElementById(id);
const state = {
  q: '', events: [], eventListings: [], currentEvent: null, adminTab: 'listings', admin: null,
  sell: { eventId: '', ticketTypeId: '', price: '', file: null, blob: null },
  slips: {}, payMethod: {}, evidence: null, confirmDelete: false, exported: '', menuOpen: false, partnerSent: false,
};
let user = null;
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

// ---------- shell ----------
function header(r) {
  const on = name => (r === name || (name === 'home' && r.startsWith('event-')) ? 'on' : '');
  const links = [
    ['home', t('navEvents'), true], ['how', t('navHow'), true], ['sell', t('navSell'), true],
    ['tickets', t('navTickets'), true], ['listings', t('navListings'), !!user], ['admin', t('navAdmin'), isAdmin()],
  ];
  return `<div class="wrap head-row">
    <a class="brand" href="#home" aria-label="${esc(brand.name)}"><span class="logo">${esc(brand.logoMark)}</span><span class="word">${esc(brand.shortName)}</span></a>
    <nav class="nav" aria-label="Main">${links.filter(l => l[2]).map(([id, label]) => `<a href="#${id}" class="${on(id)} ${id === 'admin' ? 'role-link' : ''}">${label}</a>`).join('')}
      <a href="#partners" class="nav-partner ${on('partners')}">${t('partnerLink')}</a></nav>
    <div class="head-actions">
      <button class="lang" data-action="lang" aria-label="Language">${getLang() === 'en' ? 'ไทย' : 'EN'}</button>
      ${user ? `<a class="head-user" href="#account">${esc(user.name)}</a>` : `<a class="btn primary sm sell-cta" href="#account">${t('signIn')}</a>`}
      <a class="partner-cta ${r === 'partners' ? 'on' : ''}" href="#partners">${t('partnerLink')}</a>
      <button class="burger" data-action="burger" aria-label="${t('menu')}" aria-expanded="${state.menuOpen}"><span></span><span></span><span></span></button>
    </div></div>`;
}
function footer() {
  return `<div class="wrap foot-row"><p>${t(api.mode === 'sample' ? 'footer' : 'footerConnected')}</p>
    <div class="foot-links"><a href="#partners">${t('partnerLink')}</a><a href="#privacy">${t('privacy')}</a>${isAdmin() ? `<a href="#pilot">${t('pilot')}</a>` : ''}
    ${testTools() ? `<a href="#test">${t('testTools')}</a><button data-action="resetDemo">${t('reset')}</button>` : ''}</div></div>`;
}

async function page(r) {
  const ctx = { api, user, state };
  if (r === 'home' || r === 'how' || r === 'venues') return homeView(ctx);
  if (r.startsWith('event-')) return eventView(ctx, r.slice(6));
  const views = { sell: sellView, tickets: ticketsView, listings: listingsView, admin: adminView, test: testView, pilot: pilotView, account: accountView, privacy: privacyView, partners: partnersView };
  return (views[r] || homeView)(ctx);
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
    location.hash = '#home';
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
