# Fableworks Development Log

## 2026-02-11 -- Phase 6 implementation (slice 1: final page prompt contract)

### Actions
- Added `src/lib/prompts/final-page.ts`:
  - `FINAL_PAGE_ASPECT_RATIO`
  - `buildFinalPagePrompt(...)`
  - `buildFinalPageRequestPayload(...)`
- Prompt contract now includes:
  - storyboard composition constraints,
  - selected character reference and invariants (`doNotChange`),
  - scene-linked props,
  - style preset + color palette consistency rules,
  - explicit "no text/watermarks/borders" output constraints.
- Added tests:
  - `src/lib/prompts/__tests__/final-page.test.ts`

### Tests
- Ran targeted suite:
  - `npm run test -- src/lib/prompts/__tests__/final-page.test.ts src/lib/prompts/__tests__/storyboard.test.ts` (pass)

## 2026-02-11 -- Phase 6 planning kickoff

### Actions
- Reviewed latest `DEV_LOG.md`, `PLAN.md` (Phase 6 section), and `CLAUDE.md` phase tracking.
- Inspected Phase 5 implementation patterns (actions, prompt drafts, run history, single/bulk generation UX) to reuse in Phase 6.
- Created detailed execution plan in `PHASE6_PLAN.md` with:
  - internal phases (FP0-FP4),
  - concrete file/action/component work order,
  - status model + prompt artifact/entity conventions,
  - tests, definition of done, and open decisions.

### Open Decisions
- Confirm whether final cover generation belongs in Phase 6 or remains in storyboard flow.
- Confirm approval policy per scene version (single approved vs multiple approved).
- Confirm bulk generation default (missing/failed only vs regenerate all).
- Confirm reference payload shape for NanoBanana in final page generation.

## 2026-02-11 -- Phase 5 finalization (storyboard + cover unified flow)

### Actions
- Finalized storyboard generation workflow and moved draft cover into the same storyboard pipeline.
- Added storyboard cover card on `/admin/stories/[id]/storyboard` with:
  - generate/regenerate,
  - prompt draft save,
  - request preview modal,
  - run history modal with reuse-run support.
- Added storyboard run/prompt UX polish:
  - top-level generate/regenerate button always visible on panel cards,
  - full-width tabs,
  - modals for request payload + run history,
  - textarea-based composition fields,
  - unsaved-change indicators for composition and prompt draft.
- Added timestamp normalization for run history display and explicit `createdAt` on storyboard prompt artifacts to avoid `never` for new rows.
- Added delete-story confirmation modal (`StoryDeleteButton`) on story detail.
- Improved prompt structure consistency:
  - panel prompts and cover prompts both use sectioned, readable formats.
- Closed Phase 5 docs:
  - updated `PHASE5_PLAN.md` completion status,
  - updated `CLAUDE.md` phase tracking (Phase 6 marked current).

### Testing
- Added tests:
  - `src/app/admin/stories/[id]/storyboard/__tests__/actions.test.ts`
  - `src/components/admin/__tests__/storyboard-panel.test.tsx`
- Re-ran targeted test suites multiple times during fixes:
  - storyboard prompts, storyboard actions, storyboard panel component, and story prompt tests.
- Final targeted runs passed.

### Notes
- Existing older run-history rows may still show `never` when `created_at` is genuinely missing; new runs now persist explicit timestamps and render correctly.

## 2026-02-11 -- Phase 5 planning kickoff

### Actions
- Switched to a fresh branch for planning: `codex/phase-5-storyboard-plan`.
- Synced local `main` with remote before branching.
- Reviewed latest `DEV_LOG.md`, `PLAN.md` (Phase 5 section), and `CLAUDE.md` guardrails.
- Created detailed storyboard implementation plan in `PHASE5_PLAN.md`.

### Open Decisions
- Confirm panel aspect ratio default for storyboard (`3:2` vs `2:3`).
- Confirm whether storyboard should hard-require props bible readiness.
- Confirm whether panel mapping should always be 1:1 with scenes.

### Decisions (confirmed)
- Storyboard should target children book landscape format aligned with `11 x 8.5 in`.
- Storyboard generation is blocked until props bible is ready.
- Panel mapping is fixed: `1 scene = 1 panel`.
- Each panel must show exact prompt text before generate/regenerate.
- Admin must support single-panel generation/regeneration for testing (in addition to bulk actions).

---

## 2026-02-11 -- Phase 5 implementation (slice 1: storyboard prompts + actions + page)

### Actions
- Added storyboard prompt module:
  - `src/lib/prompts/storyboard.ts`
  - composition prompt builder + parser
  - panel image prompt builder
  - outline URL helper and storyboard aspect ratio constant
- Added storyboard actions:
  - `src/app/admin/stories/[id]/storyboard/actions.ts`
  - generate all compositions
  - generate all panel images
  - generate/regenerate single panel image (with prompt override)
  - update panel composition fields
- Added storyboard admin page:
  - `src/app/admin/stories/[id]/storyboard/page.tsx`
  - blocks generation until props bible exists
  - bulk controls + per-panel one-by-one generation support
  - exact prompt preview/edit for each panel
- Added storyboard UI components:
  - `src/components/admin/storyboard-panel.tsx`
  - `src/components/admin/storyboard-view.tsx`
- Added entry point from story detail page:
  - `Open Storyboard` button on `src/app/admin/stories/[id]/page.tsx`
- Added storyboard prompt tests:
  - `src/lib/prompts/__tests__/storyboard.test.ts`

### Tests
- Ran targeted suites:
  - `npm run test -- src/lib/prompts/__tests__/storyboard.test.ts src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts src/inngest/functions/__tests__/generate-character.test.ts` (pass)

---

## 2026-02-11 -- Phase 3 planning kickoff

### Actions
- Reviewed `PLAN.md`, `PHASE2_PLAN.md`, `CLAUDE.md`, and latest log context.
- Created `PHASE3_PLAN.md` with detailed execution order, internal generation phases (S0-S4), test plan, and definition of done.

### Open Questions
- Confirm age range options.
- Confirm spread count strategy (fixed vs age-based).
- Confirm whether Phase 3 should stay character-agnostic or optionally link a character at creation time.

### Decisions (confirmed)
- Age ranges set to `3-5`, `6-8`, `9-12`.
- Spread count should be dynamic by age range, with a minimum of 12 spreads.
- Phase 3 story creation remains character-agnostic.
- Keep prompts/story text compatible with future gender-aware pronoun substitution during personalization.

---

## 2026-02-11 -- Phase 3 implementation (slice 1: prompts + contracts)

### Actions
- Updated phase tracking in `CLAUDE.md` (Phase 2 complete, Phase 3 current).
- Created branch `codex/phase-3-story-generation`.
- Added `src/lib/prompts/story.ts` with:
  - age range contract (`3-5`, `6-8`, `9-12`)
  - dynamic spread targets (min 12 baseline, higher targets for older ranges)
  - prompt builders for concept, full generation, and single-scene regeneration
  - JSON cleanup/parser helper for fenced model outputs
  - Zod schemas and parser for normalized story output (snake_case -> camelCase)
- Added tests in `src/lib/prompts/__tests__/story.test.ts`.
- Ran targeted tests: `npm run test -- src/lib/prompts/__tests__/story.test.ts` (pass).

### Notes
- Story prompts now explicitly preserve `{{name}}` placeholder and bias toward neutral phrasing to support later pronoun personalization.

---

## 2026-02-11 -- Phase 3 implementation (slice 2: Inngest story pipeline)

### Actions
- Added `src/inngest/functions/generate-story.ts` with step-based pipeline:
  - mark story `generating`
  - generate concept
  - generate manuscript/scenes
  - persist prompt artifacts + scene rows
  - mark story `scenes_ready`
  - on error mark story `scenes_failed` and persist failure artifact
- Registered story function in `src/inngest/functions/index.ts`.
- Extended `src/lib/prompts/story.ts` with concept schema/parser.
- Added tests:
  - `src/inngest/functions/__tests__/generate-story.test.ts`
  - updated `src/lib/prompts/__tests__/story.test.ts`
- Ran targeted tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

### Notes
- Pipeline is character-agnostic and preserves `{{name}}` placeholder strategy.
- Story generation enforces minimum 12 scenes via schema validation.

---

## 2026-02-11 -- Phase 3 implementation (slice 3: stories actions + admin pages)

### Actions
- Added server actions at `src/app/admin/stories/actions.ts`:
  - `createStoryAction`
  - `updateStoryMetaAction`
  - `updateSceneAction`
  - `regenerateSceneAction`
- Added stories admin routes:
  - `src/app/admin/stories/page.tsx`
  - `src/app/admin/stories/new/page.tsx`
  - `src/app/admin/stories/[id]/page.tsx`
- Added stories admin UI components:
  - `src/components/admin/story-form.tsx`
  - `src/components/admin/story-editor.tsx`
  - `src/components/admin/story-scene-card.tsx`
  - `src/components/admin/story-detail-auto-refresh.tsx`
- Extended story prompt parser with `parseAndValidateStoryScene`.
- Verified targeted tests still pass:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/inngest/functions/__tests__/generate-story.test.ts`

### Problems
1. `npm run lint` fails in this environment due local eslint binary resolution (`Cannot find module '../package.json'` from `node_modules/.bin/eslint`).
2. `npx tsc --noEmit` fails due local typescript binary resolution (`Cannot find module '../lib/tsc.js'` from `node_modules/.bin/tsc`).
3. `npm run build` fails to fetch Google fonts (`Geist`, `Geist Mono`) because network/font fetch is unavailable in this environment.

---

## 2026-02-11 -- Phase 3 refactor (visible step-by-step flow)

### Actions
- Refactored story generation to explicit admin-visible steps:
  1) concept
  2) manuscript metadata (title + arc summary)
  3) scenes
- Reworked `src/app/admin/stories/actions.ts` to run generation per step (no auto full pipeline):
  - `createStoryAction` now creates story + generates concept immediately
  - `regenerateConceptAction`
  - `generateManuscriptAction`
  - `generateScenesAction`
  - kept `updateStoryMetaAction`, `updateSceneAction`, `regenerateSceneAction`
- Removed scene `layout` from story prompts/parsers/actions/UI:
  - updated `src/lib/prompts/story.ts`
  - updated scene editor/card components and scene update/regenerate paths
- Updated detail page to expose and control each internal step:
  - `src/app/admin/stories/[id]/page.tsx`
  - shows concept block, manuscript block, scenes block, with per-step action buttons
- Updated Inngest `generate-story` function to match new prompt contracts so it compiles if used.

### Tests
- Updated prompt tests for concept/manuscript/scenes split.
- Updated generate-story function tests for new 3-call model flow.
- Ran targeted tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

### Notes
- Story status now moves through explicit phase states (e.g. `concept_ready`, `manuscript_ready`, `scenes_ready`, and `*_failed`/`*_generating` variants), so admin can stop and review between steps.

---

## 2026-02-11 -- Phase 3 UX clarifications (metadata + scene continuity)

### Actions
- Removed redundant theme editing from story metadata editor (theme remains visible in header).
- Renamed actions for clarity:
  - `Save Story` -> `Save Title & Arc`
  - `Save Scene` -> `Save This Scene`
- Added `Save All Scenes` in story editor (persists all changed scenes in one action).
- Added helper text under regenerate button explaining continuity behavior.
- Updated scene regeneration context to use the **full story context** (all scenes), not just neighboring scenes.
- Updated prompt builder for scene regeneration to accept full-story context and reflect that in prompt instructions.

### Tests
- Re-ran targeted story tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Phase 3 UI cleanup (metadata duplication)

### Actions
- Reduced visual duplication between Step 2 and the Story metadata editor on story detail page:
  - Before scenes exist: Step 2 shows manuscript metadata details + generate/regenerate button.
  - After scenes exist: Step 2 collapses to a short note and only keeps a regenerate button.
  - Editing title/arc now happens in one place (Story metadata editor).
- Updated `src/app/admin/stories/[id]/page.tsx` accordingly.

### Tests
- Ran targeted prompt tests to verify no regressions in updated flow:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts` (pass)

---

## 2026-02-11 -- Phase 3 UI layout pass (Step 2 + Step 3 flow)

### Actions
- Merged Step 2 display and editable story metadata into one card:
  - Reworked `src/components/admin/story-editor.tsx` as the single manuscript metadata card.
  - Includes both `Save Title & Arc` and `Regenerate Manuscript Metadata`.
- Split scene editing into a dedicated component:
  - Added `src/components/admin/story-scenes-editor.tsx`.
- Updated story detail layout so Step 3 heading appears directly above scene cards:
  - Updated `src/app/admin/stories/[id]/page.tsx`.
  - Scene list no longer has story metadata card in between.

### Tests
- Ran targeted story tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Phase 4 kickoff + story deletion

### Actions
- Added admin option to delete stories:
  - `deleteStoryAction` in `src/app/admin/stories/actions.ts`
  - wired "Delete Story" button on story detail page
  - cascades through scene-linked entities (story scenes, storyboard/final-page rows via scene IDs), props, and prompt artifacts
- Added props bible prompt builder/parser:
  - `src/lib/prompts/props.ts`
  - tests in `src/lib/prompts/__tests__/props.test.ts`
- Added Phase 4 props routes/actions:
  - `src/app/admin/stories/[id]/props/page.tsx`
  - `src/app/admin/stories/[id]/props/actions.ts`
- Added props bible admin manager UI:
  - `src/components/admin/props-bible-manager.tsx`
  - supports generate props bible, manual add, edit, and delete props
- Added "Open Props Bible" entry point on story detail (enabled after scenes exist).

### Tests
- Ran targeted tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Phase 4 props precision improvements

### Actions
- Strengthened props extraction prompt to enforce production-level specificity:
  - exact colors (including HEX), material, texture, shape, scale, and lighting details
  - explicit ban on vague emotional-only phrasing
- Added per-prop scene references (`appearsInScenes`) to generated/edited props.
- Extended schema:
  - `props_bible_entries.appears_in_scenes` (JSON text)
  - generated/applied migration: `drizzle/0001_mean_iron_monger.sql`
- Updated props generation, create/update actions, and props UI to capture/edit/display scene references.
- Updated props parsing tests to validate `appearsInScenes`.

### Tests
- Ran targeted suites:
  - `npm run test -- src/lib/prompts/__tests__/props.test.ts src/lib/prompts/__tests__/story.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Phase 4 prompt refinement (no HEX + anti-vague wording)

### Actions
- Updated props extraction prompt guidance to:
  - explicitly avoid HEX color codes
  - require concrete visual language (as if describing to a blind person)
  - keep descriptions objective and unambiguous
- Kept precision constraints for consistency (color names, material, texture, scale, lighting, position).

### Tests
- Ran:
  - `npm run test -- src/lib/prompts/__tests__/props.test.ts` (pass)

---

## 2026-02-11 -- Scene UX + props visibility alignment

### Actions
- Removed duplicate Step 3 controls on story detail page:
  - Step 3 card now only appears when scenes are not generated yet.
  - Once scenes exist, "Regenerate All Scenes" moved next to "Save All Scenes" in the scene editor toolbar.
- Surfaced props directly in each scene card:
  - Loaded `props_bible_entries.appears_in_scenes` on story detail page.
  - Mapped prop titles by scene number and displayed them under each scene.
  - Added helper text clarifying scene-to-props linkage source.

### Tests
- Ran targeted tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Step 2 metadata visibility fix

### Actions
- Fixed manuscript metadata card visibility/population on story detail:
  - Step 2 now treats manuscript as present if either manuscript artifact exists or `stories.title/story_arc` exists.
  - Story editor now falls back to manuscript artifact values when `stories` table fields are empty.
- Updated `src/app/admin/stories/[id]/page.tsx`.

---

## 2026-02-11 -- Cover draft generation on story detail

### Actions
- Added draft cover generation action on story detail:
  - `generateStoryCoverAction` in `src/app/admin/stories/actions.ts`
  - generates cover image via Replicate NanoBanana, persists to R2, records prompt artifact + generated asset
- Added "Draft Cover" section on story detail page (visible once scenes exist):
  - render latest cover image
  - generate/regenerate cover button
  - file: `src/app/admin/stories/[id]/page.tsx`
- Updated story deletion to also remove `generated_assets` rows tied to the story.

### Tests
- Re-ran targeted suites:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Cover style alignment to storyboard template

### Actions
- Updated cover generation prompt/style to match storyboard template direction:
  - loose lines
  - black-and-white only
  - simple low-detail sketch style
- Switched cover generation model to `nano-banana-pro` for sketch-oriented output.
- Added outline reference wiring for cover generation:
  - uses `OUTLINE_IMAGE_URL` if set
  - falls back to `${NEXT_PUBLIC_APP_URL}/outline.png` when available
  - prompt explicitly references outline placeholder behavior if URL is unavailable
- Updated `src/app/admin/stories/actions.ts`.

### Tests
- Ran:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Cover prompt preview before image generation

### Actions
- Added reusable cover prompt helper:
  - `src/lib/prompts/cover.ts`
  - centralizes cover prompt composition + outline URL resolution.
- Story detail now shows the exact cover prompt in the Draft Cover section before generation.
- Cover generate action now accepts `coverPrompt` from the form so the submitted prompt is exactly what is visible pre-submit.
- Updated files:
  - `src/app/admin/stories/[id]/page.tsx`
  - `src/app/admin/stories/actions.ts`

### Tests
- Re-ran targeted tests:
  - `npm run test -- src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-11 -- Character prompt preview before regeneration

### Actions
- Added prompt preview/edit box to character regenerate controls so admin can inspect/edit exact NanoBanana prompt before submit.
- Wired prompt override through character regenerate action -> Inngest event payload -> generate-character function.
- If override is provided, that exact prompt is used instead of auto-built profile prompt.
- Updated files:
  - `src/components/admin/character-regenerate-controls.tsx`
  - `src/app/admin/characters/[id]/page.tsx`
  - `src/app/admin/characters/actions.ts`
  - `src/inngest/functions/generate-character.ts`

### Tests
- Ran targeted suites:
  - `npm run test -- src/inngest/functions/__tests__/generate-character.test.ts src/lib/prompts/__tests__/story.test.ts src/lib/prompts/__tests__/props.test.ts src/inngest/functions/__tests__/generate-story.test.ts` (pass)

---

## 2026-02-10 -- Project Initialization

### Actions
- Created project directory `personalized-books/`
- Wrote `PLAN.md` with full 7-phase implementation plan
- Wrote `CLAUDE.md` with project conventions, testing strategy, bug fixing protocol
- Initialized git repo, pushed to `github.com/janvandenenden/fableworks`

### Decisions
- **Testing:** Vitest (unit/component + screenshot debugging) + Playwright (E2E)
- **TypeScript:** Moderate strictness -- strict null checks, `as` casts allowed at library boundaries
- **Error handling:** Success/error result objects from server actions (no throwing)
- **Replicate models:** NanoBanana for character gen + final pages, NanoBanana Pro for storyboard sketches

### Problems
- None so far

---

## 2026-02-10 -- Phase 1: Project Setup

### Actions
- Initialized Next.js 15 project with App Router, TypeScript, Tailwind CSS
- Installed all core dependencies: openai, replicate, drizzle-orm, inngest, zustand, @aws-sdk/client-s3, stripe, @clerk/nextjs
- Installed dev dependencies: vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/jest-dom, @playwright/test, happy-dom, drizzle-kit
- Initialized shadcn/ui (Tailwind v4), added 16 components: button, card, input, select, textarea, dialog, tabs, badge, skeleton, progress, label, separator, scroll-area, dropdown-menu, sheet, sonner
- Created `.env.local` with all placeholder env vars
- Created `.env.test` with test-specific dummy values
- Created API client wrappers: `src/lib/openai.ts`, `src/lib/replicate.ts`, `src/lib/r2.ts`
- Created root layout with conditional ClerkProvider (skips when no key set)
- Created landing page at `src/app/page.tsx`
- Created admin layout with sidebar navigation at `src/app/admin/layout.tsx`
- Created admin dashboard placeholder at `src/app/admin/page.tsx`
- Created admin playground at `src/app/admin/playground/page.tsx` with model selector (OpenAI Text/Vision/Replicate), prompt input, and result display
- Created playground server actions at `src/app/admin/playground/actions.ts`
- Created middleware with conditional Clerk auth (noop when no key)
- Set up Vitest with happy-dom, React plugin, path aliases
- Set up Playwright config for E2E tests
- Created test infrastructure: setup file, mock files (openai, replicate, r2, inngest), fixture directories
- Wrote 23 unit tests across 3 test files (openai, replicate, r2)
- Created E2E test for admin playground
- Updated package.json with test scripts (test, test:watch, test:coverage, test:e2e)
- Updated .gitignore for test artifacts, env files, and local DB files

### Files Created
- `src/app/layout.tsx`, `src/app/page.tsx`
- `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- `src/app/admin/playground/page.tsx`, `src/app/admin/playground/actions.ts`
- `src/lib/openai.ts`, `src/lib/replicate.ts`, `src/lib/r2.ts`
- `src/middleware.ts`
- `vitest.config.ts`, `playwright.config.ts`
- `src/test/setup.ts`
- `src/test/mocks/openai.ts`, `src/test/mocks/replicate.ts`, `src/test/mocks/r2.ts`, `src/test/mocks/inngest.ts`
- `src/lib/__tests__/openai.test.ts`, `src/lib/__tests__/replicate.test.ts`, `src/lib/__tests__/r2.test.ts`
- `e2e/admin-playground.spec.ts`
- `.env.local`, `.env.test`
- 16 shadcn/ui component files in `src/components/ui/`

### Problems & Resolutions
1. **jsdom ESM incompatibility:** `jsdom` (via `@asamuzakjp/css-color`) failed to load ESM modules with `require()`. Switched to `happy-dom` as the Vitest test environment -- resolved.
2. **Mock constructors:** `vi.mock()` with arrow function factories produced objects that weren't constructable via `new`. Fixed by using `class` syntax in mock factories instead of arrow functions.
3. **Clerk missing publishable key:** `ClerkProvider` threw during static build without a key. Made ClerkProvider conditional -- wraps children only when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set. Same pattern for middleware.
4. **Vitest config type error in Next.js build:** `environmentMatchGlobs` doesn't exist in Vitest 4 types. Removed it and excluded `vitest.config.ts` from Next.js TypeScript checking via `tsconfig.json`.
5. **shadcn toast deprecated:** `toast` component is deprecated in latest shadcn, replaced with `sonner`.

### Verification
- All 23 unit tests pass
- Next.js build succeeds (4 static pages generated)
- Admin playground page renders with model selector, prompt input, generate button

---

## 2026-02-10 -- Phase 2: DB setup kickoff

### Actions
- Created Phase 2 detailed plan (`PHASE2_PLAN.md`) and updated CLAUDE guardrails to require per-phase plans before implementation.
- Added Drizzle schema for all core tables (`src/db/schema.ts`) and sqlite connector (`src/db/index.ts`).
- Added Drizzle config (`drizzle.config.ts`) targeting local SQLite.
- Installed `better-sqlite3` dependency (Node 18 emits engine warnings but install succeeded).
- Generated initial migration (`drizzle/0000_elite_rumiko_fujikawa.sql`) and applied it to `local.db` via `npx drizzle-kit generate && npx drizzle-kit migrate`.

### Problems & Resolutions
1. **SQLite default UUID expression rejected:** Using `randomblob` in DEFAULT caused migration parse errors. Removed default UUID generation and require IDs to be supplied by the app. Regenerated migration and applied successfully.

### Next Steps
- Add R2 helper functions and Inngest scaffolding.
- Build admin character UI (list + detail) and server actions.

---

## 2026-02-10 -- Phase 2: R2 helpers + prompts + Inngest scaffolding (intent)

### Intent
- Expand `src/lib/r2.ts` helpers and tests.
- Add character prompt builder and tests.
- Add Inngest client + function stubs for character generation.

### Actions (summary)
- Implemented R2 upload flow (server-side), character pipeline via Inngest, and admin UI for create/detail/profile/gallery/regenerate/delete.
- Hardened character generation (vision parsing, sqlite-safe inserts, Replicate polling and output handling).
- Added tests: unit (actions, generate-character polling/profile reuse, upload route) and Playwright E2E (creation, generation skipped).
### Actions (detailed)
- Added character prompt builder with style presets (`src/lib/prompts/character.ts`) and tests.
- Added Inngest client (`src/inngest/client.ts`), persist-replicate-output function, and function registry.
- Added Inngest Next.js route handler (`src/app/api/inngest/route.ts`).
- Added `generate-character` Inngest function to run vision, store profile, generate art via Replicate, persist image, and update status.
- Added admin characters list + detail pages and server action to create characters and fire generation events.
- Added upload API route that returns presigned R2 upload URLs.
- Added initial unit test for `generate-character` Inngest function with mocked dependencies.
- Updated character form to upload a child photo to R2 and store the public URL using `{userId}/{characterId}` key structure.
- Switched upload flow to send file through `/api/upload` (server-side upload) to avoid browser CORS issues.
- Improved upload route error reporting and blob handling to diagnose form-data issues.
- Normalized character creation to avoid setting `userId` when running locally without users, preventing FK failures.
- Updated character creation to proceed even if Inngest event send fails, and route to detail page on success.
- Fixed Next.js dynamic params handling for character detail route (awaited `params`).
- Added character detail UI to show profile fields, status badge, and generated image gallery.
- Fixed SQLite binding errors by serializing JSON arrays before inserting character profiles.
- Added regenerate and delete actions for characters and surfaced controls on the detail page.
- Forced Inngest route to use node runtime for better-sqlite3 compatibility.
- Fixed Inngest character status updates to use direct `eq(...)` filters to avoid sqlite binding errors.
- Stripped code fences from OpenAI vision output before JSON parsing in character generation.
- Upserted character profiles on regenerate and improved Replicate output parsing/error handling.
- Loosened vision profile parsing to coerce numbers into strings and expanded Replicate URL extraction.
- Persisted Replicate raw output snapshot to `prompt_artifacts.parameters` for debugging when no image URL is extracted.
- Expanded Replicate URL extraction (handles `image` and string outputs) and mark prompts as running.
- Added Replicate output handling for FileOutput/url()/href and ensured prompt failures are recorded if Replicate run throws.
- Switched character generation to create and poll Replicate predictions until completed.
- Added auto-refresh + progress indicator on character detail while generation is running.
- Set new character status to `generating` on creation so auto-refresh/loader shows immediately.
- Added character gallery with image selection action.
- Added profile editor + regenerate-images-only flow to reuse the saved profile.
- Hid profile editor behind an Edit button and added source image preview in details.
- Replaced duplicate style selectors with a single regenerate control.
- Refactored regenerate controls to a server form to avoid client/server action conflicts.
- Added confirm dialog for deleting characters.
- Added unit tests for character actions (regenerate/delete).
- Expanded generate-character tests to cover Replicate polling and profile reuse.
- Added tests for profile update action.
- Added tests for upload API route (json + multipart).
- Added Playwright E2E test for character creation (skips actual generation).
- Documented Inngest skip in E2E test note.
- Fixed build error by avoiding reassignment of const payload when checking existing profile.
- Refactored generate-character handler for direct test invocation and fixed upload route test to use Blob.
- Fixed upload route test mocking with vitest hoisted mocks.
- Fixed generate-character test mock chain for onConflictDoUpdate.
- Made generate-character test insert mock synchronous to support onConflict chain.
- Adjusted E2E test to use an existing public asset for file upload.
### Problems & Resolutions (detailed)
1. **better-sqlite3 native module mismatch (Node 18 vs 22):** Rebuilt module against the active Node version.
2. **Presigned upload CORS failures:** Moved upload to server-side `/api/upload` to avoid browser PUT CORS issues.
3. **Next.js params Promise in dynamic route:** Awaited `params` in detail page.
4. **SQLite binding errors with arrays and where callbacks:** Serialized JSON arrays before insert; replaced callback-style `where` with `eq(...)`.
5. **OpenAI Vision JSON formatting:** Stripped code fences; coerced numeric fields to strings.
6. **Replicate output shape variance:** Expanded URL extraction (array/object/FileOutput/url()) and recorded raw output for debugging.
7. **Replicate returning pending output:** Switched to create/poll prediction until completed.
