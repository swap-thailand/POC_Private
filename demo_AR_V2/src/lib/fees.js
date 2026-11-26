import { settings } from '../config/settings.js';

export function feeFor(price, rule = settings.feeRule) {
  if (!price || price <= 0) return 0;
  if (price <= rule.flatUpTo) return rule.flat;
  return Math.min(Math.round(price * rule.percent), rule.cap);
}

// Extra charged on card / Apple Pay payments (0 by default).
export function cardSurcharge(total, rule = settings.payments.cardSurcharge) {
  if (!rule || (!rule.percent && !rule.flat)) return 0;
  return Math.round(total * rule.percent) + rule.flat;
}

export const buyerFee = price => (settings.fees.buyer === 'standard' ? feeFor(price) : 0);
export const sellerFee = price => (settings.fees.seller === 'standard' ? feeFor(price) : 0);

// Highest listing price allowed for a ticket type.
// Strict events cap the buyer's all-in total at face value, so the buyer fee
// has to fit under face value too.
export function maxListingPrice(face, strict) {
  if (!strict) return face;
  for (let p = face; p > 0; p--) {
    if (p + buyerFee(p) <= face) return p;
  }
  return 0;
}

export function quote(price, face, strict) {
  const max = maxListingPrice(face, strict);
  const ok = Number.isInteger(price) && price > 0 && price <= max;
  const bFee = ok ? buyerFee(price) : 0;
  const sFee = ok ? sellerFee(price) : 0;
  return { ok, max, price, buyerFee: bFee, sellerFee: sFee, total: ok ? price + bFee : 0, payout: ok ? price - sFee : 0 };
}
