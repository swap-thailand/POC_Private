// Business rules and timers. Change values here, not in screens.

/* global __TEST_MODE__ */
export const TEST_MODE = typeof __TEST_MODE__ !== 'undefined' && __TEST_MODE__ === true;

export const settings = {
  currency: 'THB',
  // Who pays the protection fee: 'standard' applies feeRule, 'none' charges nothing.
  fees: { buyer: 'standard', seller: 'none' },
  // 30 THB for tickets up to 1,000 THB, otherwise 3% capped at 100 THB.
  feeRule: { flatUpTo: 1000, flat: 30, percent: 0.03, cap: 100 },
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
  // cardSurcharge is added to the buyer's total for card payments; 0 means we absorb the
  // provider's processing fee out of the protection fee.
  payments: { promptpay: true, card: true, cardSurcharge: { percent: 0, flat: 0 } },
  // Ticket files sellers and buyers can upload.
  upload: { types: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 10 * 1024 * 1024 },
  // Test-mode timer overrides (only used when TEST_MODE is on and "fast timers" is enabled).
  test: { fastHoldSeconds: 60, fastConfirmSeconds: 45 },
};
