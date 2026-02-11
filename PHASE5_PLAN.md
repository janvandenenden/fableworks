# Phase 5 — Storyboard Generation (detailed plan)

> Before starting any task: read the latest `DEV_LOG.md` and add a dated entry stub.

## Goals
- Generate a storyboard panel for every scene using a consistent sketch template style.
- Keep the hero as an outline placeholder (from `public/outline.png`) so personalization happens later.
- Make every panel editable/regeneratable with prompt transparency before image generation.
- Tie props to scenes using `appearsInScenes` so composition references are explicit.

## Scope
- Admin route: `src/app/admin/stories/[id]/storyboard/page.tsx`
- Input prerequisites: `stories.status` at least `props_ready` (or scenes ready + props available).
- Output:
  - `storyboard_panels` rows with composition fields + image URL
  - prompt artifacts for composition + image generation
- Style target: loose black-and-white storyboard sketch, minimal detail.

## Internal phases (inside Phase 5)
1) **SB0 Intake**
   - Confirm story exists, scenes exist, props bible exists.
   - Show panel list scaffold with status.

2) **SB1 Composition generation (text-first)**
   - For each scene, generate structured composition JSON:
     - background, foreground, environment
     - hero pose/action (placeholder-only)
     - camera/composition type
     - props used (prop IDs/titles)
   - Save to `storyboard_panels` even before image generation.

3) **SB2 Sketch generation (image pass)**
   - Build per-panel sketch prompt from:
     - scene description
     - SB1 composition
     - scene-linked props details
     - outline placeholder instructions
   - Run NanoBanana Pro and persist image to R2.
   - Update panel `status` + `imageUrl`.

4) **SB3 Review & per-panel regenerate**
   - Admin edits composition/prompt per panel.
   - Admin sees exact prompt before regenerate.
   - Regenerate one panel without touching others.

## Work order (small, reviewable slices)
1) [x] **Prompt + schema contracts**
   - Add `src/lib/prompts/storyboard.ts`:
     - `buildStoryboardCompositionPrompt`
     - `buildStoryboardSketchPrompt`
     - zod parsers for composition JSON
   - Enforce:
     - black/white sketch only
     - no finalized character identity (placeholder silhouette only)
     - `outline.png` reference usage

2) [x] **Server actions (phase-first, no hidden auto magic)**
   - Add `src/app/admin/stories/[id]/storyboard/actions.ts`:
     - `generateStoryboardCompositionsAction(storyId)`
     - `generateStoryboardImagesAction(storyId)`
     - `regenerateStoryboardPanelAction(panelId, promptOverride?)`
     - `updateStoryboardCompositionAction(panelId, formData)`
   - Keep same prompt-preview pattern as cover/character.

3) [x] **Admin UI**
   - Add `src/app/admin/stories/[id]/storyboard/page.tsx`:
     - step cards:
       - Step 1: Generate compositions
       - Step 2: Generate storyboard images
     - panel grid below
   - Add components:
     - `src/components/admin/storyboard-view.tsx`
     - `src/components/admin/storyboard-panel.tsx`
     - `src/components/admin/composition-form.tsx`

4) [x] **Data + persistence integration**
   - Reuse `storyboard_panels` table fields.
   - Add generated assets rows for storyboard images (type `storyboard_panel`).
   - Add prompt artifacts for:
     - composition generation
     - image generation/regeneration

5) [x] **Tests**
   - `src/lib/prompts/__tests__/storyboard.test.ts`
   - `src/app/admin/stories/[id]/storyboard/__tests__/actions.test.ts`
   - `src/components/admin/__tests__/storyboard-panel.test.tsx`
   - Optional E2E later: storyboard flow with image generation mocked.

## Prompt contract highlights
- **Composition JSON** must include:
  - `sceneNumber`
  - `camera`
  - `background`
  - `foreground`
  - `environment`
  - `heroPose`
  - `propsUsed`
- **Sketch prompt** must include:
  - explicit black-and-white loose sketch tokens
  - "white outline placeholder hero"
  - outline reference URL if available (`OUTLINE_IMAGE_URL` or `${NEXT_PUBLIC_APP_URL}/outline.png`)
  - no color rendering, no polished shading

## Status model
- Story status (additive):
  - `storyboard_generating_compositions`
  - `storyboard_compositions_ready`
  - `storyboard_generating_images`
  - `storyboard_ready`
  - `storyboard_failed`
- Panel status:
  - `pending` -> `composed` -> `generated` / `failed`

## Definition of done (Phase 5)
- [x] Admin can generate storyboard compositions and images in separate visible steps.
- [x] Each panel can be edited/regenerated independently.
- [x] Prompt preview is visible before each image generation.
- [x] `outline.png` placeholder behavior is enforced via model input references.
- [x] Scene-linked props are embedded in panel prompt/context.
- [x] New tests pass; `DEV_LOG.md` updated with outcomes.

## Open decisions to confirm
## Confirmed decisions
1) **Panel mapping:** `1 scene = 1 panel` (no scene combining).
2) **Storyboard format:** use children book page ratio for `11 x 8.5 in` (landscape ratio).
3) **Gating:** storyboard generation is blocked until props bible is ready.
4) **Prompt transparency:** every storyboard panel must expose the exact prompt before generation/regeneration.
5) **Testing mode:** admin must be able to generate storyboard panels one-by-one (single panel flow) in addition to bulk generation.

## Additional implementation requirements
- Add per-panel controls in storyboard UI:
  - `Generate This Panel`
  - `Regenerate This Panel`
  - `Prompt Preview/Edit` textarea (exact prompt sent)
- Keep bulk actions available for speed:
  - `Generate All Compositions`
  - `Generate All Panel Images`
- Enforce ratio configuration in storyboard prompt/action pipeline to match `11 x 8.5 in` landscape output intent.

## Final status (2026-02-11)
- Phase 5 implementation is complete.
- Storyboard now includes:
  - cover generation in the same workflow as panels
  - prompt draft save + unsaved-change indicators
  - per-item run history with payload visibility and reuse-run generation
  - full request preview modal
  - bulk and single-item generation/regeneration flows
