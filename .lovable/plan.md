## Problem

Two issues in the win-back flow:

1. **No close (X) button on the offer screen.** The X button only renders during the wheel step. After spinning, when the 80%-off offer appears, the user has no clear way to dismiss it. (Technically the X exists in `WinbackFlow`, but it's small/grey and easy to miss against the dense offer card.)
2. **Checkout shows full price (~R$184) instead of the 80%-off price.** When the user clicks "GARANTIR 80% OFF AGORA", the AbacatePay checkout opens at full annual price. The discount is being sent as `discount: { type: "PERCENTAGE", value: 80 }`, which is not a recognized field on AbacatePay's `/checkouts/create` endpoint, so it's silently ignored.

## Fix

### 1. Make the close (X) button obvious on the offer screen

In `src/components/retention/WinbackFlow.tsx`:
- Keep the existing X button but make it larger, higher contrast, and clearly above the offer content (border, white background, shadow).
- Add a secondary "Agora não, talvez depois" text link at the bottom of `WinbackOffer` so the dismiss action is also reachable without aiming at a small icon.

In `src/components/retention/WinbackOffer.tsx`:
- Add an `onDismiss` prop and render a subtle "Agora não" button below the main CTA that calls it.
- Wire `WinbackFlow` to pass `onClose` as `onDismiss`.

### 2. Send the 80% discount correctly to AbacatePay

In `supabase/functions/abacatepay-checkout/index.ts`:
- AbacatePay's checkout API accepts coupons via a top-level `coupons: ["CODE"]` array (or `couponCode`), not a custom `discount` object. The current `discount: { type: "PERCENTAGE", value: 80 }` is dropped by the API.
- Switch to the supported approach: when `couponValid === true`, create (idempotently) a coupon `WINBACK80` on AbacatePay with 80% off via `/coupons/create`, then attach it to the checkout body as `coupons: ["WINBACK80"]`. If the coupon already exists, we ignore the "duplicate" error and proceed.
- Also send the discounted line-item price as a fallback: include `items: [{ id: productId, quantity: 1, price: Math.round(originalPrice * 0.20) }]` so even if the coupon attachment fails for any reason, the user is charged the promo price (R$ 47,76 for annual).
- Keep all existing logic for recording `retention_offers_used` and updating `winback_attempts`.

Net result: clicking "GARANTIR 80% OFF AGORA" lands the user on an AbacatePay checkout showing **R$ 47,76/ano** instead of R$ 178,80/ano.

### Files to edit

- `src/components/retention/WinbackFlow.tsx` — bigger, more visible X button; pass `onDismiss` to offer.
- `src/components/retention/WinbackOffer.tsx` — accept `onDismiss`; render "Agora não" link below CTA.
- `supabase/functions/abacatepay-checkout/index.ts` — send the discount via the supported `coupons` field + discounted item price fallback so the checkout shows R$ 47,76.

No database migrations needed.
