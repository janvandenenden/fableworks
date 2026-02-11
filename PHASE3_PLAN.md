# Phase 3 — Story Generation (detailed plan)

> Before starting any task: read the latest `DEV_LOG.md` and add a dated entry stub.

## Goals
- Generate a full editable story from **age range + optional theme/lesson**.
- Keep generation split into clear internal phases so each phase can be iterated independently.
- Save prompts/artifacts for traceability and future regeneration.
- Prepare clean handoff data for Phase 4 (props) and Phase 5 (storyboard).
- Keep story creation character-agnostic, while supporting future gender-aware pronoun injection at book-personalization time.

## Scope for this phase
- Admin entrypoint: `src/app/admin/stories/new/page.tsx`
- Inputs: `ageRange` (required), `theme` (optional)
- Output: story record + scene list in DB (`stories`, `story_scenes`)
- Async orchestration: Inngest `generate-story`
- Editing tools: prompt editor, scene editor, single-scene regenerate

## Internal generation phases (inside Phase 3)
1) **S0 Intake**
   - Validate admin input with Zod.
   - Create `stories` row with status `draft`.
   - Trigger `story/created` event.

2) **S1 Concept brief**
   - OpenAI generates a compact concept object (emotional core, tone, visual hook).
   - Save prompt + response in `prompt_artifacts` (`entityType=story`).

3) **S2 Story outline**
   - OpenAI generates spread-by-spread outline (scene beats/page-turn pull/energy).
   - Keep protagonist placeholder as `{{name}}`.
   - Avoid gendered pronouns in generated base text where possible (prefer neutral phrasing).
   - Save artifact in `prompt_artifacts`.

4) **S3 Final manuscript scenes**
   - OpenAI converts outline to polished spread text + illustration notes.
   - Persist into `story_scenes` (`sceneNumber`, `spreadText`, `sceneDescription`, `layout`).
   - Update `stories` (`title`, `storyArc`, `status='scenes_ready'`).

5) **S4 Manual refinement loop**
   - Admin edits story title/arc and any scene.
   - Single-scene regenerate uses neighboring context (previous/next scenes) for continuity.
   - Save each regenerate/edit as a new `prompt_artifacts` row.

## Work order (small, reviewable slices)
1) **Prompt + schema contracts**
   - Add `src/lib/prompts/story.ts` with builders for S1/S2/S3 + scene-regenerate.
   - Add strict Zod schemas for each model response.
   - Add robust JSON cleanup helper (strip code fences before parse).

2) **Inngest function**
   - Add `src/inngest/functions/generate-story.ts` with step-based orchestration:
     - `mark-generating`
     - `generate-concept`
     - `generate-outline`
     - `generate-manuscript`
     - `persist-story-scenes`
     - `mark-ready`
   - Register function in `src/inngest/functions/index.ts`.

3) **Server actions**
   - Add `src/app/admin/stories/actions.ts`:
     - `createStoryAction`
     - `updateSceneAction`
     - `regenerateSceneAction`
     - `updateStoryMetaAction`
   - Follow `ActionResult<T>` return contract from `CLAUDE.md`.

4) **Admin routes + UI**
   - Add `src/app/admin/stories/page.tsx` (list view with statuses).
   - Add `src/app/admin/stories/new/page.tsx` (intake form).
   - Add `src/app/admin/stories/[id]/page.tsx` (editor).
   - Components:
     - `story-form.tsx`
     - `story-editor.tsx`
     - `scene-card.tsx`
     - `prompt-editor.tsx` (shared pattern for later phases)

5) **Tests**
   - Unit: `src/lib/prompts/__tests__/story.test.ts`
   - Inngest: `src/inngest/functions/__tests__/generate-story.test.ts`
   - Actions: `src/app/admin/stories/__tests__/actions.test.ts`
   - Components: `scene-card.test.tsx`, `prompt-editor.test.tsx`
   - E2E: `e2e/story-generation.spec.ts` (generation mocked/skipped, verify flow + edits)

6) **Docs + devlog**
   - Update `DEV_LOG.md` with implementation and issues.
   - Mark Phase 3 progress in `PLAN.md` / `CLAUDE.md` after merge.

## Data model usage (no migration required initially)
- Reuse existing:
  - `stories`: `ageRange`, `theme`, `title`, `storyArc`, `status`
  - `story_scenes`: scene rows per spread
  - `prompt_artifacts`: all prompts/responses, model metadata, failures
- If traceability is insufficient, add migration later for:
  - `story_generation_phase` marker in `prompt_artifacts.structuredFields`
  - optional `revision_note` per artifact

## Status model for stories
- `draft` -> created, not generated yet
- `generating` -> S1/S2/S3 running
- `scenes_ready` -> manuscript persisted and editable
- `scenes_failed` -> generation failed (with `prompt_artifacts.errorMessage`)

## Mock code (illustrative)

```ts
// src/lib/prompts/story.ts
export function buildStoryIntakePrompt(input: { ageRange: string; theme?: string }) {
  return {
    system: "You are a children's author. Return JSON only.",
    user: [
      `Age range: ${input.ageRange}`,
      input.theme ? `Theme/Lesson: ${input.theme}` : "Theme/Lesson: none",
      "Use {{name}} as protagonist placeholder.",
    ].join("\n"),
  };
}
```

```ts
// src/inngest/functions/generate-story.ts (outline)
export const generateStory = inngest.createFunction(
  { id: "generate-story" },
  { event: "story/created" },
  async ({ event, step }) => {
    await step.run("mark-generating", () => setStoryStatus(event.data.id, "generating"));
    const concept = await step.run("generate-concept", () => runConcept(event.data));
    const outline = await step.run("generate-outline", () => runOutline(event.data, concept));
    const manuscript = await step.run("generate-manuscript", () =>
      runManuscript(event.data, concept, outline)
    );
    await step.run("persist-story-scenes", () => persistScenes(event.data.id, manuscript));
    await step.run("mark-ready", () => setStoryStatus(event.data.id, "scenes_ready"));
  }
);
```

## Definition of done (Phase 3)
- Admin can create a story with only `ageRange` + optional `theme`.
- Story status moves through `draft/generating/scenes_ready` (or `scenes_failed` on error).
- Prompt artifacts are stored for each internal generation phase.
- Story and scene editing works; single-scene regenerate works with context.
- Unit + component + function tests pass; E2E flow passes with mocked generation.
- Base manuscript is compatible with later personalization rules for pronouns (e.g. him/her) without regenerating full story.

## Confirmed decisions
1) **Age range options:** `3-5`, `6-8`, `9-12`.
2) **Target spread count:** dynamic by age range, minimum `12` spreads.
3) **Admin flow:** story creation is character-agnostic in Phase 3.
4) **Pronouns/future personalization:** plan for later gender-aware pronoun substitution at personalization time (without coupling story generation to a character now).
