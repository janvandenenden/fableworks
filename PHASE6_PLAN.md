# Phase 6 -- Final Page Generation (detailed plan)

> Before starting any task: read the latest `DEV_LOG.md` and add a dated entry stub.

## Goals
- Generate final full-color pages for each story scene with strong visual consistency.
- Reuse storyboard composition as structural control while replacing placeholder hero with the selected character.
- Keep prompt transparency, per-page regenerate, and run history parity with Phase 5 UX.
- Produce versioned final pages (`version` increments) so changes are auditable and reversible.

## Scope
- Admin route: `src/app/admin/stories/[id]/pages/page.tsx`
- Inputs required:
  - story with scenes
  - storyboard panels generated (`storyboard_panels.image_url`)
  - selected character image (`character_images.is_selected = true`)
  - character profile (`character_profiles`) with invariants (`doNotChange`) and color palette
  - props bible (`props_bible_entries`) linked by `appearsInScenes`
- Outputs:
  - `final_pages` rows per scene (latest + historical versions)
  - `generated_assets` rows (`type: "final_page"`)
  - prompt artifacts for page generation + prompt drafts

## Internal phases (inside Phase 6)
1) **FP0 Intake + gating**
   - Validate prerequisites and fail with explicit admin-visible messages.
   - Block generation when selected character image is missing.
   - Block generation when storyboard panel for any scene is missing.

2) **FP1 Prompt contract + page draft preview**
   - Build deterministic per-scene prompt from:
     - scene description + spread text
     - storyboard composition + storyboard image URL
     - selected character image URL + profile attributes
     - `doNotChange` invariants
     - scene-linked props
     - style preset + color palette
   - Keep per-page prompt draft save/edit before generation (same pattern as storyboard panels).

3) **FP2 Final image generation**
   - Generate per page with NanoBanana (`MODELS.nanoBanana`) using image references.
   - Persist `prompt_artifacts` run row as `running -> success/failed`.
   - Copy output to R2 and store canonical URL.

4) **FP3 Versioning + approvals**
   - First generation creates `version = 1`.
   - Re-roll creates a new `final_pages` row with incremented version for the same scene.
   - Approval toggle marks exactly one current approved page per scene (latest-by-default policy unless manually changed).

5) **FP4 Bulk + single-page operations**
   - Bulk: generate all missing pages.
   - Single page: generate/regenerate independently.
   - Reuse-run: regenerate from a historical run payload.

## Work order (small, reviewable slices)
1) **Prompt module + schemas**
   - Add `src/lib/prompts/final-page.ts`:
     - `buildFinalPagePrompt(...)`
     - optional helper `buildFinalPageRequestPayload(...)`
     - guardrails for consistency (same child identity, clothing, palette, visual style)
   - Add parser/helpers for linked props and normalized text cleanup.

2) **Server actions (Phase 5 parity)**
   - Add `src/app/admin/stories/[id]/pages/actions.ts`:
     - `generateFinalPagesAction(storyId)` (bulk)
     - `generateFinalPageAction(storyId, sceneId, promptOverride?)` (single)
     - `generateFinalPageFromRunAction(storyId, sceneId, runArtifactId)` (reuse run)
     - `saveFinalPagePromptDraftAction(storyId, sceneId, promptOverride)`
     - `approveFinalPageVersionAction(finalPageId, approved)`
   - Follow existing action result contract and `revalidatePath` pattern used in storyboard.

3) **Admin pages UI**
   - Add `src/app/admin/stories/[id]/pages/page.tsx`:
     - status banner + gating reasons
     - bulk generate button
     - side-by-side view: storyboard panel vs latest final page
   - Add components:
     - `src/components/admin/final-pages-view.tsx`
     - `src/components/admin/final-page-card.tsx`
   - Include:
     - top-level generate/regenerate action
     - prompt editor
     - full request preview modal
     - run history modal with "Use Prompt" + "Reuse Run + Generate"
     - version list and approval controls

4) **Data + status integration**
   - Story statuses:
     - `pages_generating`
     - `pages_ready`
     - `pages_failed`
   - Persist prompt artifact entity types:
     - `final_page_image`
     - `final_page_prompt_draft`
   - Persist asset type:
     - `final_page`

5) **Navigation + workflow integration**
   - Add "Open Final Pages" entry from story detail page once storyboard is ready.
   - Keep storyboard as prerequisite step; pages route should guide user back when missing assets.

6) **Tests**
   - `src/lib/prompts/__tests__/final-page.test.ts`
   - `src/app/admin/stories/[id]/pages/__tests__/actions.test.ts`
   - `src/components/admin/__tests__/final-page-card.test.tsx`
   - `src/components/admin/__tests__/final-pages-view.test.tsx`

## Prompt contract highlights
- Must explicitly require:
  - same child identity across all pages
  - no placeholder silhouette output
  - no text overlays or captions in art
  - scene-faithful props only
  - coherent color palette and illustration style across spreads
- Should include negative constraints:
  - avoid age drift, outfit drift, facial-feature drift
  - avoid style switching and camera mismatch vs storyboard intent

## Status model
- Story status:
  - `storyboard_ready` -> `pages_generating` -> `pages_ready` (or `pages_failed`)
- Final page operational status (derived from latest artifact/run):
  - `pending` -> `generating` -> `generated` / `failed`

## Definition of done (Phase 6)
- [ ] Admin can generate all final pages from storyboard in one action.
- [ ] Admin can generate/regenerate a single page independently.
- [ ] Prompt preview/edit is available before generation for every page.
- [ ] Run history supports prompt reuse and run reuse.
- [ ] Re-roll creates new page versions and preserves prior versions.
- [ ] Approval state is manageable per scene version.
- [ ] Story status transitions to `pages_ready` only when all scenes have a generated page.
- [ ] New tests pass; `DEV_LOG.md` updated with outcomes and issues.

## Open decisions to confirm
1) **Cover handling in Phase 6:** keep cover generated in storyboard flow, or generate a final cover variant in this phase as well.
2) **Approval policy:** allow multiple approved versions historically, or enforce one approved version per scene.
3) **Bulk behavior:** regenerate all pages every time, or only generate missing/failed pages by default.
4) **Reference payload format:** use `image` only vs multi-reference payload fields (depends on confirmed NanoBanana input contract used in this repo).

## Proposed defaults (if no further input)
1) Keep cover out of Phase 6 (use existing storyboard cover output for now).
2) Enforce one approved version per scene.
3) Bulk action generates only missing/failed pages; explicit "Regenerate all" can be a separate action later.
4) Start with currently proven payload shape and expand only if quality requires stronger multi-reference control.
