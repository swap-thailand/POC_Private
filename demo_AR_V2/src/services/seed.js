// Sample data for the demo. All names, prices and orders are made up.
// Event dates are real public dates; check them before showing to organizers.

const iso = s => new Date(s).toISOString();
const BKK = 7 * 3600000;

// Clutch Fridays is weekly, so it always points at the coming Friday 22:00 Bangkok time
// (tonight's, if it's Friday night and the party is still on).
export function nextFriday22(now) {
  const local = new Date(now + BKK);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 22) - BKK);
  d.setUTCDate(d.getUTCDate() + ((5 - local.getUTCDay() + 7) % 7));
  if (d.getTime() + 6 * 3600000 < now) d.setUTCDate(d.getUTCDate() + 7);
  if (d.getTime() - 7 * 86400000 + 6 * 3600000 >= now) d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}

export function seed(now = Date.now()) {
  const users = [
    { id: 'u_admin', name: 'Team Admin', email: 'admin@example.com', roles: ['admin', 'buyer', 'seller'], banned: false, verified: true, lineId: '', consentAt: iso(now) },
    { id: 'u_you', name: 'You (test buyer)', email: 'you@example.com', roles: ['buyer', 'seller'], banned: false, verified: true, lineId: '', consentAt: iso(now) },
    { id: 'u_ploy', name: 'Ploy K.', email: 'ploy@example.com', roles: ['seller', 'buyer'], banned: false, verified: true, swaps: 12, rating: 4.9 },
    { id: 'u_nat', name: 'Nat S.', email: 'nat@example.com', roles: ['seller', 'buyer'], banned: false, verified: true, swaps: 4, rating: 5.0 },
    { id: 'u_mike', name: 'Mike T.', email: 'mike@example.com', roles: ['seller', 'buyer'], banned: false, verified: true, swaps: 7, rating: 4.8 },
    { id: 'u_fah', name: 'Fah R.', email: 'fah@example.com', roles: ['seller', 'buyer'], banned: false, verified: true, swaps: 21, rating: 4.9 },
    { id: 'u_aom', name: 'Aom P.', email: 'aom@example.com', roles: ['seller', 'buyer'], banned: false, verified: true, swaps: 9, rating: 5.0 },
    { id: 'u_joy', name: 'Joy M.', email: 'joy@example.com', roles: ['seller', 'buyer'], banned: false, verified: false, swaps: 0, rating: null },
    { id: 'u_sam', name: 'Sam R.', email: 'sam@example.com', roles: ['buyer'], banned: false, verified: true },
    { id: 'u_mint', name: 'Mint J.', email: 'mint@example.com', roles: ['buyer'], banned: false, verified: true },
  ];

  const events = [
    {
      id: 'wp', name: 'White Party Bangkok', posterTitle: 'WHITE PARTY', subtitle: 'Main Event · NYE',
      startsAt: '2026-12-30T20:00:00+07:00', venue: 'Paragon Hall, Siam Paragon', city: 'Bangkok',
      artists: ['Joe Gauthreaux', 'Enrico Meloni'], strictFaceValue: true, published: true,
      transfer: { en: 'Name change in pre-registration (allowed once). Collect the wristband with matching ID.', th: 'เปลี่ยนชื่อตอนลงทะเบียนล่วงหน้า (ได้ครั้งเดียว) รับริสต์แบนด์ด้วยบัตรประชาชนที่ชื่อตรงกัน' },
    },
    {
      id: 'clutch', name: 'Clutch Fridays', posterTitle: 'CLUTCH', subtitle: 'House & disco',
      startsAt: nextFriday22(now), venue: 'Clutch', city: 'Bangkok',
      artists: ['Resident DJs'], strictFaceValue: false, published: true, weekly: true,
      transfer: { en: 'QR e-ticket reissued to the buyer by the seller.', th: 'ผู้ขายออกอีทิกเก็ต QR ใหม่ในชื่อผู้ซื้อ' },
    },
    {
      id: 'edc', name: 'EDC Thailand', posterTitle: 'EDC', subtitle: '3-day festival',
      startsAt: '2026-12-18T15:00:00+07:00', venue: 'Rhythm Park', city: 'Phuket',
      artists: ['Under the Electric Sky'], strictFaceValue: false, published: true,
      transfer: { en: 'Unworn delivered wristband, handed over in person.', th: 'ริสต์แบนด์ที่ยังไม่ได้ใส่ ส่งมอบตัวต่อตัว' },
    },
    {
      id: 's2o', name: 'S2O Songkran', posterTitle: 'S2O', subtitle: 'Water music festival',
      startsAt: '2027-04-13T16:00:00+07:00', venue: 'TBA', city: 'Bangkok',
      artists: ['Lineup TBA'], strictFaceValue: false, published: true,
      transfer: { en: 'To be announced.', th: 'ยังไม่ประกาศ' },
    },
  ];

  const ticketTypes = [
    { id: 'wp_main', eventId: 'wp', name: { en: 'Main Event GA', th: 'Main Event บัตรทั่วไป' }, faceValue: 3200 },
    { id: 'wp_nye', eventId: 'wp', name: { en: 'NYE Countdown GA', th: 'NYE Countdown บัตรทั่วไป' }, faceValue: 3500 },
    { id: 'wp_all', eventId: 'wp', name: { en: 'All Night Pass GA', th: 'All Night Pass บัตรทั่วไป' }, faceValue: 8800 },
    { id: 'cl_entry', eventId: 'clutch', name: { en: 'Entry', th: 'บัตรเข้างาน' }, faceValue: 250 },
    { id: 'cl_drink', eventId: 'clutch', name: { en: 'Entry + 1 drink', th: 'บัตรเข้างาน + เครื่องดื่ม 1 แก้ว' }, faceValue: 300 },
    { id: 'edc_ga', eventId: 'edc', name: { en: '3-Day GA wristband', th: 'ริสต์แบนด์ 3 วัน บัตรทั่วไป' }, faceValue: 9590 },
    { id: 'edc_vip', eventId: 'edc', name: { en: '3-Day VIP wristband', th: 'ริสต์แบนด์ 3 วัน VIP' }, faceValue: 15590 },
    { id: 's2o_ga', eventId: 's2o', name: { en: 'GA (TBA)', th: 'บัตรทั่วไป (รอประกาศ)' }, faceValue: 3000 },
  ];

  const file = name => ({ name, type: 'application/pdf', size: 120000, dataUrl: null });
  const listing = (id, ticketTypeId, sellerId, price, status = 'approved', minutesAgo = 600) => {
    const type = ticketTypes.find(tt => tt.id === ticketTypeId);
    return { id, eventId: type.eventId, ticketTypeId, sellerId, price, status, file: file(`${id}.pdf`), rejectReason: '', createdAt: iso(now - minutesAgo * 60000) };
  };

  const listings = [
    listing('l1', 'wp_main', 'u_ploy', 2900),
    listing('l2', 'wp_nye', 'u_nat', 3390),
    listing('l3', 'wp_all', 'u_mike', 8000),
    listing('l4', 'cl_drink', 'u_fah', 250),
    listing('l5', 'cl_entry', 'u_ploy', 250),
    listing('l6', 'edc_ga', 'u_aom', 9200),
    listing('l7', 'wp_main', 'u_joy', 3000, 'pending', 20),
    listing('l8', 'cl_entry', 'u_fah', 250, 'reserved', 90),
    listing('l9', 'edc_ga', 'u_nat', 9590, 'sold', 300),
  ];

  const hist = (status, minutesAgo, by) => ({ status, at: iso(now - minutesAgo * 60000), by });
  const orders = [
    // Sam has sent a payment slip for a Clutch ticket: shows in the admin payments queue.
    {
      id: 'o1', listingId: 'l8', buyerId: 'u_sam', price: 250, buyerFee: 30, sellerFee: 0, total: 280, payout: 250,
      status: 'payment_submitted', reservedUntil: iso(now + 5 * 60000), createdAt: iso(now - 8 * 60000),
      slip: { name: 'promptpay-slip.jpg', type: 'image/jpeg', size: 90000, dataUrl: null }, dispute: null,
      history: [hist('reserved', 8, 'u_sam'), hist('payment_submitted', 4, 'u_sam')],
    },
    // Mint paid for an EDC wristband: waiting for the seller to transfer.
    {
      id: 'o2', listingId: 'l9', buyerId: 'u_mint', price: 9590, buyerFee: 100, sellerFee: 0, total: 9690, payout: 9590,
      status: 'paid', reservedUntil: iso(now - 200 * 60000), createdAt: iso(now - 240 * 60000), slip: { name: 'slip.png', type: 'image/png', size: 80000, dataUrl: null }, dispute: null,
      history: [hist('reserved', 240, 'u_mint'), hist('payment_submitted', 236, 'u_mint'), hist('paid', 200, 'u_admin')],
    },
  ];

  const waitlist = [
    { id: 'w1', eventId: 's2o', channel: 'line', contact: '@sample.fan', consent: true, createdAt: iso(now - 3600000), notifiedAt: null },
    { id: 'w2', eventId: 's2o', channel: 'email', contact: 'fan@example.com', consent: true, createdAt: iso(now - 7200000), notifiedAt: null },
    { id: 'w3', eventId: 'wp', channel: 'line', contact: '@wp.hopeful', consent: true, createdAt: iso(now - 9000000), notifiedAt: null },
  ];

  return {
    version: 3,
    currentUserId: 'u_you',
    users, events, ticketTypes, listings, orders, waitlist,
    audit: [],
    activity: [],
    feedback: [],
    partnerLeads: [],
    testSettings: { skipApproval: false, fastTimers: false },
  };
}
