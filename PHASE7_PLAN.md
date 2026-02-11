# Phase 7 -- Internal Fulfillment (detailed plan)

> Before starting any task: read the latest `DEV_LOG.md` and add a dated entry stub.

## Goals
- Generate production-quality PDFs from approved final pages.
- Enable manual admin print submission to Lulu for internal test shipments.
- Keep fulfillment flow admin-first and Stripe-independent for now.
- Validate physical output quality before exposing customer checkout.

## Scope
- Admin surface only (no customer checkout gating in this phase).
- Input prerequisites:
  - story has final pages generated (and ideally approved per scene),
  - story metadata + scene text are complete.
- Output:
  - book PDF persisted to R2,
  - `books` table updated with `pdfUrl`,
  - optional Lulu job metadata on manual print submission.

## Internal phases (inside Phase 7)
1) **IF0 Readiness + gating**
   - Ensure all scenes have a final page.
   - Optionally require at least one approved version per scene.
   - Show clear admin reasons when generation/print is blocked.

2) **IF1 PDF generation pipeline**
   - Add `generate-pdf` function/action with deterministic page order.
   - Compose spreads with story text + final page image.
   - Persist PDF to R2 and update `books`.

3) **IF2 Admin review + download**
   - Add internal admin page to preview metadata and download PDF.
   - Track generation time/status and last output URL.

4) **IF3 Manual Lulu submission**
   - Add explicit admin action: `Send to Lulu`.
   - Persist `luluPrintJobId` and status fields.
   - Add manual status refresh action for test cycles.

5) **IF4 QA loop**
   - Print one copy to home address.
   - Capture trim/bleed/margin/color findings.
   - Iterate PDF template and rerun print until quality baseline is acceptable.

## Work order (small, reviewable slices)
1) **PDF template + helpers**
   - Add:
     - `src/lib/pdf/book-template.tsx`
     - `src/lib/pdf/spread-layout.tsx`
   - Keep layout constants centralized (page size, bleed-safe margins, typography defaults).

2) **Generation action/function**
   - Add:
     - `src/inngest/functions/generate-pdf.ts` (or route-local server action first, then move to Inngest)
   - Persist artifacts and resulting PDF URL.

3) **Admin fulfillment route**
   - Add:
     - `src/app/admin/books/page.tsx`
     - `src/app/admin/books/[id]/page.tsx`
   - Include buttons:
     - `Generate PDF`
     - `Download PDF`
     - `Send to Lulu`
     - `Refresh Print Status`

4) **Lulu client + actions**
   - Add:
     - `src/lib/lulu.ts`
     - admin actions under fulfillment routes.
   - Use sandbox credentials first.

5) **Tests**
   - `src/inngest/functions/__tests__/generate-pdf.test.ts`
   - `src/lib/__tests__/lulu.test.ts`
   - `src/app/admin/books/__tests__/actions.test.ts`
   - Optional E2E: `e2e/internal-fulfillment.spec.ts` for admin PDF + print trigger smoke path.

## Definition of done (Phase 7)
- [ ] Admin can generate a PDF from final pages and download it.
- [ ] PDF is stored in R2 and linked from `books`.
- [ ] Admin can manually submit a Lulu print job.
- [ ] Admin can refresh and see print status updates.
- [ ] At least one successful internal print shipment is completed.
- [ ] Test coverage exists for PDF generation and Lulu client/actions.

## Open decisions to confirm
1) Require strict approval per scene before PDF generation (`all approved`) vs allow latest version fallback.
2) Single trim size fixed now vs configurable trim profiles.
3) Keep Lulu submission manual-only for all envs in Phase 7, or allow optional auto-submit in dev.

## Proposed defaults (if no further input)
1) Require all scenes to have at least one generated final page; prefer approved versions, fallback to latest.
2) Use one fixed print format for internal QA (reduce variable complexity).
3) Manual Lulu submission only in Phase 7.

## Remaining validation loop (before Phase 7 close)
- [ ] Run one real end-to-end internal print cycle on a polished story:
  - final pages -> final personalized cover -> print export -> Lulu submit -> status refresh.
- [ ] Resolve any Lulu rejection reasons (file specs, package compatibility, shipping data).
- [ ] Place one internal test order to home address and verify physical output quality.
- [ ] Record findings (trim/bleed/margins/color/text readability) and adjust templates/prompts.
- [ ] Re-run one confirmation print after fixes.
