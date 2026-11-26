// Business rules checked directly against the sample data layer (no browser).
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

test.describe.configure({ mode: 'serial' });

const at = iso => Date.parse(iso);
let fake = 0;
let api;

test.beforeAll(async () => {
  globalThis.__TEST_MODE__ = true;
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fake])); }
    static now() { return fake; }
  };
  fake = at('2026-11-27T21:00:00+07:00');
  ({ mockAdapter: api } = await import('../src/services/mockAdapter.js'));
  await api.resetDemo();
});

async function paidOrder(listingId, sellerId) {
  await api.actAs('u_you');
  const o = await api.reserveListing(listingId);
  await api.submitPaymentSlip(o.id, { name: 's.png', type: 'image/png', size: 10 });
  await api.actAs('u_admin');
  await api.markPaymentReceived(o.id);
  await api.actAs(sellerId);
  return o.id;
}
const statusOf = async id => { await api.actAs('u_you'); return (await api.myOrders()).find(o => o.id === id).status; };

test('a late transfer still gets the minimum confirm window', async () => {
  fake = at('2026-11-28T01:30:00+07:00'); // Clutch doors were 22:00
  const id = await paidOrder('l4', 'u_fah');
  fake = at('2026-11-28T01:50:00+07:00');
  await api.markTransferred(id);
  fake = at('2026-11-28T02:30:00+07:00'); // past start + 4h, but only 40 min after transfer
  expect(await statusOf(id)).toBe('transferred');
  fake = at('2026-11-28T03:51:00+07:00'); // 2h after transfer
  expect(await statusOf(id)).toBe('confirmed');
});

test('banned buyers cannot hold tickets', async () => {
  await api.actAs('u_admin');
  await api.setBanned('u_sam', true);
  await expect(api.createOrderFor('u_sam', 'l2')).rejects.toMatchObject({ code: 'banned' });
});

test('weekly club night rolls forward once it is over', async () => {
  fake = at('2026-11-29T12:00:00+07:00');
  const clutch = (await api.listEvents()).find(e => e.id === 'clutch');
  expect(clutch.startsAt).toBe('2026-12-04T15:00:00.000Z');
});

test('production build refuses to fall back to sample data', () => {
  const env = { ...process.env, SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', DEMO_TEST_MODE: '' };
  expect(() => execSync('npx vite build --outDir /tmp/prod-check', { env, stdio: 'pipe' })).toThrow(/Production build needs/);
});
