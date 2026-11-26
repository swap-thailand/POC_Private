import { settings } from '../config/settings.js';
import { t, getLang } from '../i18n/index.js';
import { esc, baht, eventDate, num } from '../lib/format.js';
import { poster, heart } from './components.js';

// Event card. The whole card links to the event (stretched link); the Interested button sits on
// top of it in the bottom-right corner so fans can tap it without opening the event.
export function eventCard(ev) {
  const interest = `<button class="int-mini ${ev.youInterested ? 'on' : ''}" data-action="toggleInterest" data-id="${esc(ev.id)}"
      aria-pressed="${!!ev.youInterested}" aria-label="${t('interestBtn')}: ${esc(ev.name)}">${heart(ev.youInterested)}
      <span>${t('interestedN', { n: num(ev.interestedCount || 0) })}</span></button>`;
  return `<article class="ev-card" data-event="${esc(ev.id)}">${poster(ev)}
    <div class="ev-info"><span class="ev-date">${esc(eventDate(ev.startsAt, getLang()))}</span>
    <h3><a class="ev-link" href="#event-${esc(ev.id)}">${esc(ev.name)}</a></h3>
    <p>${esc(ev.venue)}, ${esc(ev.city)}</p>
    <div class="ev-foot"><span class="pill ${ev.liveCount ? '' : 'muted-pill'}">${ev.liveCount ? t('listed', { n: ev.liveCount }) : t('waitlistOpen')}</span>
    ${ev.minTotal ? `<span class="ev-from">${t('from')} <b>${baht(ev.minTotal)}</b></span>` : ''}
    ${interest}</div></div></article>`;
}

export function eventGrid(events, q) {
  const needle = q.trim().toLowerCase();
  const rows = needle
    ? events.filter(e => [e.name, e.venue, e.city, ...(e.artists || [])].join(' ').toLowerCase().includes(needle))
    : events;
  return rows.length ? rows.map(eventCard).join('') : `<p class="muted">${t('noResults')}</p>`;
}

export async function homeView({ api, state }) {
  const events = await api.listEvents();
  state.events = events;
  const f = events.find(e => e.liveCount) || events[0];
  return `
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy"><span class="kicker">${t('heroKicker')}</span><h1>${t('heroTitle')}</h1><p class="lead">${t('heroSub')}</p>
    <div class="hero-search"><input id="q" data-input="search" placeholder="${t('search')}" value="${esc(state.q)}" aria-label="${t('search')}">
    <button class="btn primary" data-action="scrollEvents">${t('ctaBuy')}</button></div>
    <ul class="trust"><li>${t('t1')}</li><li>${t('t2')}</li><li>${t('t3')}</li></ul></div>
  ${f ? `<div class="hero-aside"><a href="#event-${esc(f.id)}" class="feature">${poster(f, true)}<div class="feature-meta"><b>${esc(f.name)}</b><span>${t('listed', { n: f.liveCount })}</span></div></a></div>` : ''}
</div></section>
<section class="section" id="events"><div class="wrap"><div class="sec-head"><h2>${t('upcoming')}</h2></div><div class="events-grid" id="grid">${eventGrid(events, state.q)}</div></div></section>
<section class="section how" id="how"><div class="wrap"><div class="sec-head"><h2>${t('howTitle')}</h2></div>
  <div class="how-grid">${['buyers', 'sellers'].map((k, j) => `<div class="how-col"><h3>${t(k)}</h3><ol>${[1, 2, 3].map(i => `<li><b>${i}</b><span>${t((j ? 'hs' : 'hb') + i)}</span></li>`).join('')}</ol></div>`).join('')}</div>
</div></section>
<section class="band"><div class="wrap band-row"><div class="band-ico">🛡</div><div><h2>${t('gTitle')}</h2><p>${t('gBody')}</p></div></div></section>
<section class="section venues" id="venues"><div class="wrap venues-grid"><div><span class="kicker">${t('venuesKicker')}</span><h2>${t('venuesTitle')}</h2><p class="lead">${t('venuesBody')}</p>
  <div class="btn-row"><a class="btn primary" href="#partners">${t('venuesMore')}</a><button class="btn line" data-action="lineToast">${t('venuesCta')}</button></div></div>
  <div class="stat-stack"><div class="stat"><b>${Math.round(settings.pricing.maxMarkup * 100)}%</b><span>${t('capStat')}</span></div><div class="stat"><b>24/7</b><span>LINE</span></div><div class="stat"><b>TH · EN</b><span>${t('navEvents')}</span></div></div></div></section>
<section class="section faq"><div class="wrap narrow"><div class="sec-head"><h2>${t('faqTitle')}</h2></div>${[1, 2, 3, 4].map(i => `<details><summary>${t('q' + i)}</summary><p>${t('a' + i)}</p></details>`).join('')}</div></section>`;
}
