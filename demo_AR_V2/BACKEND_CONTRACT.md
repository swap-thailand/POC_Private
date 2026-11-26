# Backend contract for the v2 front end

The screens only talk to `api` from `src/services/index.js`. There are two implementations:

- `mockAdapter.js`: sample data in localStorage. It is the reference behavior; every rule below is implemented there.
- `supabaseAdapter.js`: real backend. Sign-in, events and seller submission work (ported from v1). Everything else throws `ServiceError('notConnected')`.

To connect a feature, replace one `notConnected` stub with a real call that returns the same shape as the mock. Nothing in `views/` should need to change. Throw `ServiceError(code)` for expected failures; the UI maps codes to messages (`src/services/errors.js`): `notSignedIn`, `forbidden`, `banned`, `priceTooHigh`, `fileError`, `unavailable`, `consent`, `invalid`, `reasonRequired`.

Every money value is an integer number of THB.

## Business rules the backend must enforce

These are enforced in the mock and must also be enforced server-side, since the browser can't be trusted.

1. **Price cap.** `price <= face value` of the ticket type. On a strict event (`strict_face_value = true`) the buyer's total must also stay at or under face value: the max price is the largest `p` with `p + buyerFee(p) <= face`.
2. **Fees** (`settings.feeRule`): 30 THB up to 1,000 THB, otherwise 3% rounded, capped at 100 THB. Buyer pays the fee on top; the seller pays nothing (configurable).
3. **One active order per listing.** Active = reserved, payment_submitted, paid, transferred, confirmed, disputed.
4. **Hold expiry.** A reserved order expires 10 minutes after creation; the listing goes back to approved. Needs a scheduled job (pg_cron or an edge function) rather than the mock's on-read sweep.
5. **Auto-confirm.** A transferred order auto-confirms at the later of `event.starts_at + 4 hours` and `transferred_at + 2 hours`. Never before the event starts, and never less than 2 hours after a late transfer.
6. **Banned users** can't submit listings or hold tickets, and their live listings are hidden.
7. **No self-approval.** An admin can't approve a listing they are selling.
8. **Duplicate tickets.** Reject a listing whose ticket is already listed or sold (at least a file hash; ideally the barcode or order number). The sample demo does not do this yet.
9. **Past events.** Hide events and block holds 12 hours after `starts_at`. The v1 view already hides started events.
10. **Admin role** is checked server-side for every review-desk call. Never trust a client flag.
11. **Every admin action writes an audit row.**

## Order and listing statuses

Listing: `pending → approved | rejected`, then `approved → reserved → sold`, or `withdrawn` (by the seller, or after a refund).

Order:

```
reserved ─slip─▶ payment_submitted ─admin received─▶ paid ─seller transferred─▶ transferred
   │                    │                              │                           │
 expired /          cancelled                       refunded              confirmed (buyer or auto)
 cancelled       (payment rejected)                                         │        │
                                                                     payout_released  disputed ─▶ refunded | payout_released
```

The v1 table only allows `reserved | completed | cancelled`, so this needs a migration.

## Schema changes needed

What exists (v1 migration `20261122000000_marketplace.sql`): `profiles`, `events` (one `face_value_thb`), `listings`, `orders`, `ticket_verifications`, view `marketplace_available_listings`, RPC `marketplace_submit_listing`, private bucket `marketplace-tickets` at `userId/listingId`.

Suggested additions (names are suggestions, shapes match the mock):

| Change | Why |
| --- | --- |
| `ticket_types (id, event_id, name_en, name_th, face_value_thb)` and `listings.ticket_type_id` | Face-value cap per ticket type |
| `events.strict_face_value boolean default false` | Total-under-face rule |
| `profiles.roles text[]`, `banned bool`, `verified bool`, `line_id`, `consent_at`, `deleted_at` | Roles, bans, PDPA |
| `orders`: new status values, `buyer_fee_thb`, `seller_fee_thb`, `total_thb`, `payout_thb`, `reserved_until`, `transferred_at`, `confirmed_at`, `cancel_reason` | Order flow |
| `order_events (order_id, status, at, by)` | Status history for the timeline |
| `payment_slips (order_id, path, uploaded_at)` + private bucket `payment-slips` at `buyerId/orderId` | Manual PromptPay |
| `orders.payment_method ('promptpay'|'card'|'apple_pay')`, `payment_ref`, `card_surcharge_thb`, `charged_thb` | Card / Apple Pay |
| `disputes (order_id, reason, note, evidence_path, created_at, resolved_at, resolution)` | Report a problem |
| `listings.reject_reason` (or use `ticket_verifications.notes`) | Rejection reason shown to seller |
| `waitlist (id, event_id, user_id null, channel 'line'|'email', contact, consent, created_at, notified_at)` | Alert me |
| `audit_log (id, at, actor_id, action, target, detail)` | Review desk audit |
| `partner_leads (id, first_name, last_name, email, contact, company, roles text[], city, volume, ticketing, message, consent, created_at)`, insert-only for anon, read for admins | Partner with us form |
| `activity (at, type, detail, user_id null)` and `feedback (at, channel, text)` | Pilot dashboard |

## Function reference

Shapes are abbreviated; see `mockAdapter.js` (`listingView`, `eventView`, `orderView`) for the full objects.

### Session
| Function | Input | Returns | Notes |
| --- | --- | --- | --- |
| `currentUser()` | | `{id, name, email, roles[], banned, verified}` or null | Connected today (roles hardcoded to buyer/seller) |
| `signIn({name, email, lineId, consent})` | | user, or `{pendingEmailLink:true}` | Connected (OTP). Store `consent_at` |
| `signOut()` | | | Connected |
| `deleteAccount()` | | | Withdraw live listings, drop waitlist rows, anonymize profile, keep orders |

### Catalog
| Function | Returns |
| --- | --- |
| `listEvents()` | `event[]` with `ticketTypes[]`, `liveCount`, `minTotal`, `waitlistCount`, `strictFaceValue`. Connected (one default ticket type per event until `ticket_types` exists) |
| `getEvent(id)` | `{event, listings: listing[]}`; listing has `ticketType`, `price`, `faceValue`, `buyerFee`, `total`, `seller {name, verified, swaps, rating}`. Connected |
| `trackView(eventId)` | Insert into `activity` |

### Seller
| Function | Input | Notes |
| --- | --- | --- |
| `submitListing({eventId, ticketTypeId, price, file, fileBlob})` | Connected via upload + RPC. Needs `ticket_type_id` and the strict rule added to the RPC |
| `myListings()` | Each listing plus `event` and latest `order` (for "transfer now" and payout status). Connected without order info |
| `withdrawListing(id)` | Only pending/approved, only own |
| `markTransferred(orderId)` | Only the seller, only when paid. Sets `transferred_at` |

### Buyer
| Function | Input | Notes |
| --- | --- | --- |
| `reserveListing(listingId)` | Atomic: lock listing, check no active order, create order with fees and `reserved_until`. Should be an RPC |
| `submitPaymentSlip(orderId, file)` | Upload to `payment-slips`, status → payment_submitted |
| `payByCard(orderId, {method})` | Server creates a hosted checkout session with the payment provider for `total + cardSurcharge` and returns its URL; the browser redirects there. The provider's webhook (verified signature) marks the order paid and the listing sold. Never collect card numbers in our app. Apple Pay comes through the same hosted page on supported devices. Refunds of card orders go back through the provider |
| `cancelReservation(orderId)` | Buyer only, while reserved |
| `myOrders()` | `order[]` with `event`, `ticketType`, `seller.name`, `history[]`, `confirmDeadline`, `eventStarted`. Returns `[]` today |
| `confirmEntry(orderId)` | transferred → confirmed |
| `reportProblem(orderId, {reason, note, file})` | From paid, transferred or confirmed (before payout). Freezes payout |
| `joinWaitlist(eventId, {channel, contact, consent})` | Consent required |
| `submitPartnerLead({firstName, lastName, email, contact, company, roles[], city, volume, ticketing, message, consent})` | Public form. Consent, name, email and company required. Rate-limit it |

### Admin (all require the admin role)
| Function | Notes |
| --- | --- |
| `adminData()` | `{pendingListings, payments, transfers, disputes, payouts, waitlist[{event,count,pending}], sellers, partnerLeads, audit}` |
| `approveListing(id)` / `rejectListing(id, reason)` | Write `ticket_verifications` + audit |
| `setBanned(userId, banned)` | Can't ban admins |
| `getListingFile(id)` / `getSlip(orderId)` | Return a short-lived signed URL. Audit file views |
| `markPaymentReceived(orderId)` / `rejectPayment(orderId, reason)` | Received → paid, listing sold. Rejected → cancelled, listing back on sale |
| `releasePayout(orderId)` | From confirmed or disputed (admin sides with seller). Real transfer is manual for now |
| `refundOrder(orderId, note)` | From paid, transferred or disputed |
| `notifyWaitlist(eventId)` | Marks `notified_at`; sending LINE/email is a later step |
| `pilotData()`, `addFeedback()`, `exportData()` | Pilot dashboard |

### Test tools
`listUsers`, `actAs`, `addUser`, `createOrderFor`, `liveListingsForTest`, `get/setTestSettings`, `runTimers`, `resetDemo` exist only for the sample demo. They should **not** be built against Supabase. The connected adapter reports `capabilities.testTools = false`, which hides them.

## Security notes

- Only the publishable/anon key ever reaches the browser; `vite.config.js` refuses a service-role key at build time.
- Ticket files and slips stay in private buckets. Buyers never see the seller's ticket file.
- Test mode is a build flag (`__TEST_MODE__`), off for `npm run build`. Don't deploy `build:demo` to a production domain.
- `npm run build` fails without Supabase keys, so a production deploy can't silently run on sample data.
