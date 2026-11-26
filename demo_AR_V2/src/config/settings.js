// Business rules and timers. Change values here, not in screens.

/* global __TEST_MODE__ */
export const TEST_MODE = typeof __TEST_MODE__ !== 'undefined' && __TEST_MODE__ === true;

export const settings = {
  currency: 'THB',
  // Pricing follows TicketSwap's model (scenario 8 in the JingTix financial model):
  // - sellers can list up to maxMarkup above face value (0.2 = 20%, so 120% of face);
  // - buyers pay a service fee of buyerPercent on the listed price, payment costs included;
  // - sellers pay sellerPercent of the listed price, taken from their payout.
  // Events marked strictFaceValue ignore maxMarkup: the buyer's total, fee included, stays at face value.
  // policyMarkup is the advertised cap (copy, partner page); maxMarkup is what the Sell form enforces.
  // On the live site maxMarkup drops to 0 until dbFeatures.resaleMarkup is on (see services/index.js).
  pricing: { maxMarkup: 0.2, policyMarkup: 0.2, buyerPercent: 0.10, sellerPercent: 0.05, buyerMin: 0, sellerMin: 0 },
  // Live-site (Supabase) switches for features that need migration
  // supabase/migrations/20261126000000_resale_cap_and_interests.sql. Turn each on only after that
  // migration is applied to production and verified. Sample-data demos always have both.
  dbFeatures: { resaleMarkup: false, interests: false },
  // Example events on the live site (services/showcase.js), labelled "Example" everywhere.
  // 'auto': show them only while the database has no upcoming published events, so real events
  //         replace them automatically the moment they go live. 'always': show them after real events.
  // 'off': never. Sample-data demos are unaffected (they are all sample data already).
  showcase: { mode: 'auto' },
  // How long a buyer can hold a listing while paying.
  holdMinutes: 10,
  // The buyer's confirm window closes this many hours after the event starts,
  // or minConfirmAfterTransferHours after the seller transfers, whichever is later.
  // Nothing auto-confirms before the event has started.
  confirmWindowHours: 4,
  minConfirmAfterTransferHours: 2,
  // Events drop off the site this many hours after they start.
  hideEventAfterHours: 12,
  // How buyers can pay. PromptPay is manual (slip + admin check). Card and Apple Pay go
  // through a hosted checkout from a payment provider, so card numbers never touch our app.
  // cardSurcharge is added to the buyer's total for card payments; 0 because the 10% buyer
  // fee already covers payment processing (TicketSwap-style).
  payments: { promptpay: true, card: true, cardSurcharge: { percent: 0, flat: 0 } },
  // Ticket files sellers and buyers can upload.
  upload: { types: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 10 * 1024 * 1024 },
  // Test-mode timer overrides (only used when TEST_MODE is on and "fast timers" is enabled).
  test: { fastHoldSeconds: 60, fastConfirmSeconds: 45 },
};
