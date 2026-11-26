import { settings } from '../config/settings.js';

// TicketSwap-style fees: a percentage of the listed price on each side, rounded to whole baht.
const pct = (price, percent, min) => (!price || price <= 0 ? 0 : Math.max(Math.round(price * percent), min || 0));

export const buyerFee = (price, rule = settings.pricing) => pct(price, rule.buyerPercent, rule.buyerMin);
export const sellerFee = (price, rule = settings.pricing) => pct(price, rule.sellerPercent, rule.sellerMin);

// Extra charged on card / Apple Pay payments (0 by default: the buyer fee covers it).
export function cardSurcharge(total, rule = settings.payments.cardSurcharge) {
  if (!rule || (!rule.percent && !rule.flat)) return 0;
  return Math.round(total * rule.percent) + rule.flat;
}

// Highest listing price allowed for a ticket type.
// Normal events: up to maxMarkup above face value (120% of face by default).
// Strict events cap the buyer's all-in total at face value, so the buyer fee has to fit under it.
export function maxListingPrice(face, strict, rule = settings.pricing) {
  if (!strict) return Math.floor(face * (1 + rule.maxMarkup));
  for (let p = face; p > 0; p--) {
    if (p + buyerFee(p, rule) <= face) return p;
  }
  return 0;
}

// Listed price relative to face value: 0 at face, 0.1 at 10% over. Negative below face.
export const markupOf = (price, face) => (face ? price / face - 1 : 0);

export function quote(price, face, strict) {
  const max = maxListingPrice(face, strict);
  const ok = Number.isInteger(price) && price > 0 && price <= max;
  const bFee = ok ? buyerFee(price) : 0;
  const sFee = ok ? sellerFee(price) : 0;
  return { ok, max, price, buyerFee: bFee, sellerFee: sFee, total: ok ? price + bFee : 0, payout: ok ? price - sFee : 0, markup: ok ? markupOf(price, face) : 0 };
}
