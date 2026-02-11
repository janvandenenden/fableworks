# Phase 8 -- Customer Commerce UX (detailed plan)

> Before starting any task: read the latest `DEV_LOG.md` and add a dated entry stub.

## Goals
- Launch a clean customer flow from character/story selection through Stripe checkout.
- Convert paid orders into internal fulfillment-ready records without exposing admin complexity.
- Provide customer-facing order/book status pages with clear progress states.
- Keep Stripe in test mode until real-world fulfillment loop is confirmed.
- Enforce cost control: no expensive generation (final pages/PDF) before successful payment.

## Scope
- Customer-facing app routes + payment/webhook infrastructure.
- Integrates with existing Phase 7 admin fulfillment pipeline.
- Output:
  - paid `orders` created and updated from Stripe webhook,
  - corresponding `books` records initialized for fulfillment,
  - customer can view order/book status and download when available.
  - generation credits tracked for paid users (for controlled re-rolls).

## Cost-control policy (critical)
- Character/story draft setup can happen pre-payment (low-cost metadata only).
- High-cost operations are locked until payment is confirmed:
  - final page generation,
  - cover finalization,
  - print export generation.
- After purchase, user receives limited re-roll credits:
  - page re-roll credits (per-page),
  - optional character re-roll credits.
- Re-roll actions must decrement credits atomically and reject when balance is 0.

## Internal phases (inside Phase 8)
1) **CX0 Foundation + guardrails**
   - Define customer route structure (`/create/*`, `/books/*`).
   - Add auth gating policy for customer pages (Clerk-protected).
   - Add order ownership checks on all customer data reads.

2) **CX1 Checkout preparation flow**
   - Build customer create flow state model (character, story, review).
   - Persist draft selection before checkout.
   - Add pricing display and shipping expectation messaging.

3) **CX2 Stripe checkout + webhook**
   - Create checkout session server action/API route.
   - Include metadata for `storyId`, `userId`, and internal correlation IDs.
  - Implement webhook handling for payment success/failure.
  - Update `orders.paymentStatus` and initialize/update `books` rows.
  - Allocate initial generation credits on successful payment.

4) **CX3 Customer order + book status UI**
   - Add `/books` list and `/books/[id]` detail route.
  - Show payment status, fulfillment status, tracking URL, and download availability.
  - Add customer-friendly timeline labels from internal statuses.
  - Show remaining re-roll credits and disable re-roll actions when credits are exhausted.

5) **CX4 Reliability + QA hardening**
   - Add idempotency for webhook processing.
   - Add retry-safe state transitions.
   - Add end-to-end test coverage for checkout and webhook roundtrip.

## Work order (small, reviewable slices)
1) **Customer route scaffolding + auth guards**
   - Add:
     - `src/app/(app)/create/character/page.tsx`
     - `src/app/(app)/create/story/page.tsx`
     - `src/app/(app)/create/checkout/page.tsx`
     - `src/app/(app)/create/generating/page.tsx`
     - `src/app/(app)/books/page.tsx`
     - `src/app/(app)/books/[id]/page.tsx`
   - Ensure user can only access own draft/order/book records.

2) **Flow state + server actions**
   - Add:
     - `src/stores/create-book.ts`
     - `src/app/(app)/create/actions.ts`
   - Persist selected character/story and draft order intent.

3) **Stripe integration**
   - Add:
     - `src/lib/stripe.ts`
     - `src/app/api/webhooks/stripe/route.ts`
     - `src/app/(app)/create/checkout/actions.ts`
   - Use Stripe test mode and webhook signature verification.

4) **Fulfillment handoff contract**
- On payment success:
  - set `orders.paymentStatus = paid`,
  - initialize/find `books` row,
  - mark next-step status for Phase 7 fulfillment processing,
  - initialize credit balances for re-roll allowances.

5) **Customer status presentation**
- Add internal->customer status mapping helper:
  - `src/lib/order-status.ts`
- Convert technical statuses to buyer-friendly copy.

6) **Credit + abuse controls**
- Add credit state storage (order-level or book-level):
  - example fields: `pageRerollCredits`, `characterRerollCredits`.
- Add server-side guards for expensive actions:
  - require `orders.paymentStatus = paid`,
  - require sufficient credits for re-roll actions,
  - record credit usage events for auditing.

6) **Tests**
   - `src/lib/__tests__/stripe.test.ts`
   - `src/stores/__tests__/create-book.test.ts`
  - `src/app/api/webhooks/stripe/__tests__/route.test.ts`
  - `src/app/(app)/create/__tests__/credits.test.ts`
  - `e2e/book-creation-flow.spec.ts`
  - `e2e/checkout.spec.ts`

## Definition of done (Phase 8)
- [ ] Authenticated customer can complete create -> checkout -> paid flow in Stripe test mode.
- [ ] Webhook updates order state safely and idempotently.
- [ ] Customer sees order/book status in `/books` and `/books/[id]`.
- [ ] Download appears when PDF is available.
- [ ] Expensive generation is blocked for unpaid users.
- [ ] Re-roll actions consume credits and stop at zero.
- [ ] Ownership/auth checks prevent cross-user data access.
- [ ] Automated coverage exists for checkout + webhook + status UI core path.

## Open decisions to confirm
1) Should payment immediately trigger auto-fulfillment (Phase 7 pipeline), or stay admin-reviewed for now?
2) Single fixed product/price in Phase 8 vs configurable formats/options at checkout.
3) Required shipping address collection in checkout now vs defer until print submission stage.
4) Initial default credit amounts for page/character re-rolls.

## Proposed defaults (if no further input)
1) Keep admin-reviewed fulfillment handoff (no fully automatic print submission yet).
2) Use single fixed product and price for first customer launch.
3) Collect shipping address during checkout so order is complete at payment time.
4) Grant a small default credit pack on purchase (example: 3 page re-rolls, 1 character re-roll).

## Remaining validation loop (before Phase 8 close)
- [ ] Run complete Stripe test checkout with webhook confirmation.
- [ ] Verify customer can only see own orders/books.
- [ ] Confirm paid order appears in admin fulfillment queue cleanly.
- [ ] Validate customer status copy is clear and non-technical.
- [ ] Run one end-to-end demo from fresh account to fulfilled-ready state.
