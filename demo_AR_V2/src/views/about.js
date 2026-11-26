import { t } from '../i18n/index.js';

// About us: why JingTix exists. The problem, who it is for, and a way in.
export function aboutView() {
  const cards = (prefix, n) => [...Array(n)].map((_, i) => `<div class="pt-card"><h3>${t(`${prefix}${i + 1}T`)}</h3><p>${t(`${prefix}${i + 1}B`)}</p></div>`).join('');
  return `
<section class="hero ab-hero"><div class="wrap">
  <span class="kicker">${t('ab_kicker')}</span><h1>${t('ab_title')}</h1><p class="lead">${t('ab_sub')}</p>
</div></section>

<section class="section pt-dark"><div class="wrap"><div class="sec-head"><h2>${t('ab_probTitle')}</h2></div>
  <div class="pt-cards">${cards('ab_prob', 3)}</div>
</div></section>

<section class="section"><div class="wrap"><div class="sec-head"><h2>${t('ab_whyTitle')}</h2></div>
  <p class="lead" style="margin-bottom:22px;max-width:720px">${t('ab_whySub')}</p>
  <div class="pt-cards">${cards('ab_why', 3)}</div>
</div></section>

<section class="section ab-cta"><div class="wrap">
  <h2>${t('ab_ctaTitle')}</h2><p class="lead">${t('ab_ctaSub')}</p>
  <div class="btn-row"><a class="btn primary" href="#home">${t('ab_ctaEvents')}</a>
    <a class="btn ghost" href="#partners">${t('partnerLink')}</a>
    <button class="btn line" data-action="lineToast">${t('pt_ctaLine')}</button></div>
</div></section>`;
}
