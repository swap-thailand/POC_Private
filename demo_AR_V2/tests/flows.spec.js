import { test, expect } from '@playwright/test';

const png = { name: 'ticket.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex') };

async function actAs(page, id) {
  await page.selectOption('#actAsSel', id);
  await expect(page.locator('#actAsSel')).toHaveValue(id);
  await page.waitForTimeout(150);
}
async function go(page, hash) {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(150);
}
// Selling needs a verified profile (demo verification, kept in memory until reload).
async function openSell(page, { load = false } = {}) {
  if (load) await page.goto('/#sell'); else await go(page, '#sell');
  const start = page.locator('[data-action=startVerification]');
  if (await start.isVisible().catch(() => false)) await start.click();
  await expect(page.locator('[data-input=sellEvent]')).toBeVisible();
}
async function adminTab(page, id) {
  await go(page, '#admin');
  await page.locator(`[data-action=adminTab][data-id=${id}]`).click();
}
// Buyer holds l1 (White Party, seller Ploy), sends a slip, admin marks it paid, Ploy transfers.
async function buyToTransferred(page) {
  await page.goto('/#event-wp');
  await page.locator('[data-action=openListing][data-id=l1]').click();
  await page.locator('[data-action=reserve]').click();
  const order = page.locator('.order').first();
  await expect(order.locator('.chip')).toHaveText('Waiting for payment');
  await order.locator('input[data-file^=slip-]').setInputFiles(png);
  await expect(order.locator('.file-drop')).toHaveClass(/done/);
  await order.locator('[data-action=submitSlip]').click();
  await expect(page.locator('.order').first().locator('.chip')).toHaveText('Checking your payment');
  const orderId = await page.locator('.order').first().getAttribute('data-order');

  await actAs(page, 'u_admin');
  await adminTab(page, 'payments');
  await page.locator(`[data-action=markReceived][data-id=${orderId}]`).click();
  await expect(page.locator(`[data-row=${orderId}]`)).toHaveCount(0);

  await actAs(page, 'u_ploy');
  await go(page, '#listings');
  await page.locator(`[data-action=markTransferred][data-id=${orderId}]`).click();
  await expect(page.locator('[data-listing=l1]')).toContainText('Payout after the buyer confirms entry');
  return orderId;
}

test('home lists events from the data layer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ev-card')).toHaveCount(4);
  await expect(page.locator('.ev-card').first()).toContainText('listed');
});

test('full swap: hold, slip, paid, transfer, confirm, payout', async ({ page }) => {
  const orderId = await buyToTransferred(page);
  await actAs(page, 'u_you');
  await go(page, '#tickets');
  const order = page.locator(`[data-order=${orderId}]`);
  await expect(order.locator('.chip')).toHaveText('Transferred, confirm entry');
  await order.locator('[data-action=confirmEntry]').click();
  await expect(page.locator(`[data-order=${orderId}] .chip`)).toHaveText('Confirmed');

  await actAs(page, 'u_admin');
  await adminTab(page, 'payouts');
  await page.locator(`[data-action=releasePayout][data-id=${orderId}]`).click();
  await adminTab(page, 'audit');
  await expect(page.locator('.audit')).toContainText('payout_released');

  await actAs(page, 'u_ploy');
  await go(page, '#listings');
  await expect(page.locator('[data-listing=l1]')).toContainText('Paid out ฿3,040'); // ฿3,200 less the 5% seller fee
});

test('dispute freezes payout and admin refunds', async ({ page }) => {
  const orderId = await buyToTransferred(page);
  await actAs(page, 'u_you');
  await go(page, '#tickets');
  await page.locator(`[data-order=${orderId}] [data-action=openDispute]`).click();
  await page.selectOption('#modal select[name=reason]', 'invalid');
  await page.fill('#modal textarea[name=note]', 'QR rejected at the door');
  await page.locator('#modal button[type=submit]').click();
  await expect(page.locator(`[data-order=${orderId}] .chip`)).toHaveText('Problem reported');

  await actAs(page, 'u_admin');
  await adminTab(page, 'disputes');
  await expect(page.locator(`[data-row=${orderId}]`)).toContainText('QR rejected at the door');
  await page.locator(`[data-action=refund][data-id=${orderId}]`).click();

  await actAs(page, 'u_you');
  await go(page, '#tickets');
  await expect(page.locator(`[data-order=${orderId}] .chip`)).toHaveText('Refunded');
});

test('new listing waits for review, admin approves it', async ({ page }) => {
  await openSell(page, { load: true });
  await page.selectOption('[data-input=sellEvent]', 'edc');
  await page.locator('input[data-file=ticketFile]').setInputFiles(png);
  await page.fill('[data-input=sellPrice]', '9000');
  await page.locator('[data-action=submitListing]').click();
  const row = page.locator('.listing-row').first();
  await expect(row.locator('.chip')).toHaveText('In review');
  const id = await row.getAttribute('data-listing');

  await actAs(page, 'u_admin');
  await adminTab(page, 'listings');
  await page.locator(`[data-action=approve][data-id=${id}]`).click();
  await go(page, '#event-edc');
  await expect(page.locator(`[data-action=openListing][data-id=${id}]`)).toBeVisible();
});

test('skip-approval test toggle puts new listings live immediately', async ({ page }) => {
  await page.goto('/#test');
  await page.locator('[data-action=toggleSetting][data-id=skipApproval]').check();
  await openSell(page);
  await page.selectOption('[data-input=sellEvent]', 'clutch');
  await page.locator('input[data-file=ticketFile]').setInputFiles(png);
  await page.fill('[data-input=sellPrice]', '200');
  await page.locator('[data-action=submitListing]').click();
  await expect(page.locator('.listing-row').first().locator('.chip')).toHaveText('Live');
});

test('strict face-value event keeps the buyer total at face value', async ({ page }) => {
  await openSell(page, { load: true });
  await page.selectOption('[data-input=sellEvent]', 's2o');
  await expect(page.locator('#sellSummary')).toContainText('max ฿2,727'); // ฿2,727 + 10% fee = ฿3,000 face
  await page.fill('[data-input=sellPrice]', '2800');
  await expect(page.locator('#sellSummary')).toContainText("Price can't be above the maximum.");
  await page.fill('[data-input=sellPrice]', '2727');
  await expect(page.locator('#sellSummary')).toContainText('Buyer pays');
  await expect(page.locator('#sellSummary')).toContainText('฿3,000');
});

test('normal events allow up to 20% over face value, with TicketSwap-style fees', async ({ page }) => {
  await openSell(page, { load: true });
  await page.selectOption('[data-input=sellEvent]', 'wp'); // Main Event GA, face ฿3,200
  await expect(page.locator('#sellSummary')).toContainText('Max price: ฿3,840 (20% over face value)');
  await page.fill('[data-input=sellPrice]', '3841');
  await expect(page.locator('#sellSummary')).toContainText("Price can't be above the maximum.");
  await page.fill('[data-input=sellPrice]', '3520');
  const q = page.locator('#sellSummary');
  await expect(q).toContainText('+10% over face');
  await expect(q).toContainText('฿3,872'); // buyer pays 3,520 + 10%
  await expect(q).toContainText('−฿176'); // 5% seller fee
  await expect(q).toContainText('฿3,344'); // seller receives
  await page.goto('/#event-wp');
  await expect(page.locator('.row-card').first()).toContainText('incl. ฿320 service fee');
});

test('about us page tells the story and the partner page no longer repeats the problem section', async ({ page }) => {
  await page.goto('/#home');
  const about = page.viewportSize().width > 860 ? page.locator('.nav a[href="#about"]') : page.locator('.site-foot a[href="#about"]');
  await about.click();
  await expect(page.locator('h1')).toHaveText('By the community, for the community.');
  await expect(page.locator('#page')).toContainText('Why a ticket exchange, why now');
  await expect(page.locator('#page .pt-card')).toHaveCount(6);
  await go(page, '#partners');
  await expect(page.locator('#page')).not.toContainText('Why a ticket exchange, why now');
  const icon = await page.locator('link[rel=icon][type="image/svg+xml"]').getAttribute('href');
  expect(icon.startsWith('data:image/svg+xml')).toBe(true);
});

test('interested: fans mark an event and the count goes up and down', async ({ page }) => {
  await page.goto('/#event-edc');
  const btn = page.locator('.interest-btn');
  await expect(page.locator('.int-count')).toHaveText('2,310 people interested');
  await btn.click();
  await expect(page.locator('.interest-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.int-count')).toHaveText('2,311 people interested');
  await page.reload();
  await expect(page.locator('.int-count')).toHaveText('2,311 people interested');
  await go(page, '#home');
  const card = page.locator('.ev-card[data-event=edc]');
  await expect(card.locator('.int-mini')).toContainText('2,311 interested');
  await expect(card.locator('.int-mini')).toHaveAttribute('aria-pressed', 'true');
  // tapping the heart on the card toggles it without opening the event
  await card.locator('.int-mini').click();
  await expect(page.locator('.ev-card[data-event=edc] .int-mini')).toContainText('2,310 interested');
  await expect(page).toHaveURL(/#home$/);
  await page.locator('.ev-card[data-event=edc] .int-mini').click();
  await page.locator('.ev-card[data-event=edc] .ev-link').click();
  await expect(page).toHaveURL(/#event-edc$/);
  await go(page, '#event-edc');
  await page.locator('.interest-btn').click();
  await expect(page.locator('.interest-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.int-count')).toHaveText('2,310 people interested');
});

test('partner page shows the dashboard charts and pricing', async ({ page }) => {
  await page.goto('/#partners');
  await expect(page.locator('.pt-charts .pt-chart')).toHaveCount(4);
  await expect(page.locator('.pt-charts .ch-col')).toHaveCount(21);
  await expect(page.locator('.pt-pricing')).toContainText('Priced like TicketSwap, capped at 20%');
  await expect(page.locator('.pt-pricing')).toContainText('฿4,224');
  await page.locator('.pt-charts .ch-row').first().focus();
  await expect(page.locator('.ch-tip')).toHaveClass(/on/);
  await expect(page.locator('.ch-tip')).toContainText('Face value');
});

test('admin creates an order for a manually added buyer', async ({ page }) => {
  await page.goto('/#test');
  await page.fill('form[data-form=addUser] input[name=name]', 'Bank Test');
  await page.fill('form[data-form=addUser] input[name=email]', 'bank@example.com');
  await page.locator('form[data-form=addUser] button[type=submit]').click();
  await expect(page.locator('.users-list')).toContainText('Bank Test');
  const buyer = await page.locator('form[data-form=createOrder] select[name=buyer] option', { hasText: 'Bank Test' }).getAttribute('value');
  await page.selectOption('form[data-form=createOrder] select[name=buyer]', buyer);
  await page.selectOption('form[data-form=createOrder] select[name=listing]', 'l6');
  await page.locator('form[data-form=createOrder] button[type=submit]').click();
  await actAs(page, buyer);
  await go(page, '#tickets');
  await expect(page.locator('.order')).toHaveCount(1);
  await expect(page.locator('.order .chip')).toHaveText('Waiting for payment');
});

test('fast timers: an unpaid hold expires and the ticket goes back on sale', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#test');
  await page.locator('[data-action=toggleSetting][data-id=fastTimers]').check();
  await go(page, '#event-clutch');
  await page.locator('[data-action=openListing][data-id=l4]').click();
  await page.locator('[data-action=reserve]').click();
  await expect(page.locator('.order').first().locator('.chip')).toHaveText('Waiting for payment');
  await page.clock.fastForward('01:05');
  await expect(page.locator('.order').first().locator('.chip')).toHaveText('Hold expired');
  await go(page, '#event-clutch');
  await expect(page.locator('[data-action=openListing][data-id=l4]')).toBeVisible();
});

test('Thai language switch and privacy consent on sign-in', async ({ page }) => {
  await page.goto('/#account');
  await page.locator('[data-action=signOut]').click();
  await go(page, '#account');
  await page.fill('form[data-form=signIn] input[name=email]', 'new@example.com');
  await page.locator('form[data-form=signIn] button[type=submit]').click();
  await expect(page.locator('#toast')).toContainText('consent');
  await page.locator('form[data-form=signIn] input[name=consent]').check();
  await page.locator('form[data-form=signIn] button[type=submit]').click();
  await go(page, '#account'); // signed in: the account page shows the profile, not the sign-in form
  await expect(page.locator('form[data-form=signIn]')).toHaveCount(0);
  await page.locator('.head-actions [data-action=lang]').click(); // the account page has its own language toggle too
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.locator('.page-title, h1').first()).not.toHaveText(/Find your way in/);
});

test('delete account removes the profile', async ({ page }) => {
  await page.goto('/#account');
  await page.locator('[data-action=askDelete]').click();
  await page.locator('[data-action=deleteAccount]').click();
  await go(page, '#account');
  await expect(page.locator('form[data-form=signIn]')).toBeVisible();
});

test('partner page: venue submits an enquiry and admin sees it', async ({ page }) => {
  await page.goto('/#partners');
  await expect(page.locator('h1')).toContainText('Your crowd, your rules.');
  await page.locator('[data-action=scrollTo][data-id=partnerForm]').click();
  const f = page.locator('form[data-form=partnerLead]');
  await f.locator('input[name=firstName]').fill('Nok');
  await f.locator('input[name=email]').fill('nok@club.example');
  await f.locator('input[name=company]').fill('Sample Club Sathorn');
  await f.locator('input[name=roles][value=club]').check();
  await f.locator('select[name=city]').selectOption('bangkok');
  await f.locator('button[type=submit]').click();
  await expect(page.locator('#toast')).toContainText('consent');
  await f.locator('input[name=consent]').check();
  await f.locator('button[type=submit]').click();
  await expect(page.locator('.pt-thanks')).toBeVisible();

  await actAs(page, 'u_admin');
  await adminTab(page, 'partners');
  await expect(page.locator('.admin-panel')).toContainText('Sample Club Sathorn');
});

test('admins cannot approve their own listing', async ({ page }) => {
  await page.goto('/#test');
  await actAs(page, 'u_admin');
  await openSell(page);
  await page.selectOption('[data-input=sellEvent]', 'edc');
  await page.locator('input[data-file=ticketFile]').setInputFiles(png);
  await page.fill('[data-input=sellPrice]', '9000');
  await page.locator('[data-action=submitListing]').click();
  const id = await page.locator('.listing-row').first().getAttribute('data-listing');
  await adminTab(page, 'listings');
  await page.locator(`[data-action=approve][data-id=${id}]`).click();
  await expect(page.locator('#toast')).toContainText('Another admin');
});

test('card / Apple Pay: paid instantly, skips the slip check', async ({ page }) => {
  await page.goto('/#event-wp');
  await page.locator('[data-action=openListing][data-id=l2]').click();
  await page.locator('[data-action=reserve]').click();
  const order = page.locator('.order').first();
  const orderId = await order.getAttribute('data-order');
  await order.locator('[data-action=payMethod][data-method=card]').click();
  await page.locator(`[data-order=${orderId}] [data-action=openCheckout][data-method=card]`).click();
  await page.locator('#modal [data-action=declineCard]').click();
  await expect(page.locator('#toast')).toContainText('declined');
  await expect(page.locator(`[data-order=${orderId}] .chip`)).toHaveText('Waiting for payment');
  await page.locator(`[data-order=${orderId}] [data-action=openCheckout][data-method=apple_pay]`).click();
  await page.locator('#modal [data-action=payCard]').click();
  await expect(page.locator(`[data-order=${orderId}] .chip`)).toHaveText('Paid, waiting for transfer');
  await expect(page.locator(`[data-order=${orderId}]`)).toContainText('Paid with Apple Pay');

  await actAs(page, 'u_admin');
  await adminTab(page, 'payments');
  await expect(page.locator(`[data-row=${orderId}]`)).toHaveCount(0);
  await adminTab(page, 'transfers');
  await expect(page.locator(`[data-row=${orderId}]`)).toContainText('Apple Pay');
});

test('Partner with us sits at the far right of the header', async ({ page }) => {
  await page.goto('/');
  if ((page.viewportSize()?.width || 0) > 860) {
    const cta = page.locator('.head-actions .partner-cta');
    await expect(cta).toBeVisible();
    await expect(page.locator('.head-actions > :visible').last()).toHaveClass(/partner-cta/);
    await cta.click();
  } else {
    await page.locator('[data-action=burger]').click();
    await page.locator('.nav .nav-partner').click();
  }
  await expect(page.locator('h1')).toContainText('Your crowd, your rules.');
});

test('socials: footer and About us link to the official accounts, opening in a new tab', async ({ page }) => {
  await page.goto('./#home');
  const foot = page.locator('.foot-icons a');
  await expect(foot).toHaveCount(3);
  await expect(foot.nth(0)).toHaveAttribute('href', 'https://www.instagram.com/jingtix/');
  await expect(foot.nth(1)).toHaveAttribute('href', 'https://x.com/jingtix');
  await expect(foot.nth(2)).toHaveAttribute('href', 'https://www.facebook.com/profile.php?id=61596768340479');
  for (let i = 0; i < 3; i++) await expect(foot.nth(i)).toHaveAttribute('rel', /noopener/);
  await page.goto('./#about');
  await expect(page.locator('.social-card')).toHaveCount(3);
});

test('header logo: two swap arrows travel round the ring', async ({ page }) => {
  await page.goto('./#home');
  const logo = page.locator('header .logo svg');
  await expect(logo.locator('animateTransform')).toHaveCount(1);
  await expect(logo.locator('animateTransform')).toHaveAttribute('dur', '7s');
  await expect(logo.locator('g[transform*="translate(14 0)"] path')).toHaveCount(2);
});
