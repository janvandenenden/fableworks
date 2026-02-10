# Phase 2 — Database & Character Generation (detailed plan)

> Before starting any task: read the latest `DEV_LOG.md` and add a dated entry stub.

## Goals
- Stand up data layer (Drizzle + migrations) and storage helpers.
- Implement character-generation pipeline (Inngest + OpenAI Vision + Replicate + R2).
- Build admin UI to drive and view character generation.
- Ship tests (schema, prompts, functions, UI, E2E).

## Prereqs
- ENV: `DATABASE_URL`, R2 creds, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, Inngest keys (or mocked locally).
- Tools: `drizzle-kit`, `inngest-cli` installed (already in deps).

## Work order (small, reviewable slices)
1) **Schema + migration**
   - Author `src/db/schema.ts` tables (users, characters, character_profiles, character_images, prompt_artifacts, generated_assets).
   - Configure `drizzle.config.ts` if needed.
   - Run `npx drizzle-kit generate` → commit migration and snapshot.
   - Add `src/db/index.ts` connector (pg in prod, better-sqlite3 in dev).
   - Smoke test: simple query in a temp script or unit test.

2) **R2 storage helpers**
   - Expand `src/lib/r2.ts` with `uploadToR2(buffer,key,contentType)`, `getPresignedUploadUrl(key)`, `copyFromTempUrl(sourceUrl,destKey)`.
   - Add small unit tests with mocked S3 client.

3) **Prompt: character builder**
   - `src/lib/prompts/character.ts`:
     - Style tokens map (watercolor, storybook, anime, flat, colored-pencil).
     - `buildCharacterPrompt(profile, style)` returns a string; ensure `do_not_change` invariants appended.
   - Vitest: cover each style + invariant inclusion.

4) **Inngest plumbing**
   - `src/inngest/client.ts` initialized with keys; mock fallback in tests.
   - `src/inngest/functions/persist-replicate-output.ts`: copy temp URL → R2, create `generated_assets` row, link to prompt_artifact.
   - `src/inngest/functions/generate-character.ts` steps:
     1. Vision: call OpenAI on uploaded photo → structured profile.
     2. Insert `character_profiles`.
     3. Build prompt with style preset.
     4. Call Replicate NanoBanana (image-to-image with source upload).
     5. Persist temp URL via `persist-replicate-output` helper; create `character_images` row; update `characters.status='ready'`.
   - Include idempotency guard on character_id+style per run token to avoid duplicates on retries.
   - Unit tests: mock OpenAI/Replicate/R2/Inngest; assert DB writes and status transitions.

5) **Admin UI for characters**
   - Routes: `src/app/admin/characters/page.tsx` (list) and `src/app/admin/characters/[id]/page.tsx` (detail optional) or a single page with modal.
   - Components in `src/components/admin/`:
     - `character-form.tsx` (upload, name, gender, style select, generate button → server action).
     - `character-gallery.tsx` (grid of variants; select favorite).
     - `character-profile-view.tsx` (table of extracted attributes).
   - Server actions colocated under `src/app/admin/characters/actions.ts`:
     - `createCharacterAction(formData)` → create row, store upload URL, trigger Inngest event.
     - `selectCharacterImageAction(characterId, imageId)` → mark `is_selected=true`.
   - Wire toast notifications on failures (`sonner`).

6) **API surface**
   - `src/app/api/upload/route.ts`: presign direct uploads to R2 (restrict mime/size).
   - `src/app/api/inngest/route.ts`: Inngest serve endpoint (already scaffolded in Phase 1 if present).

7) **Testing**
   - Schema tests: defaults, relations, enum-ish fields.
   - Prompt tests: style tokens + invariants.
   - Inngest tests: generate-character end-to-end with mocks; persist-replicate-output.
   - Component tests: form renders/validates; gallery selects; profile view displays.
   - E2E: character creation flow (upload → generate → see variant).

8) **DX & logging**
   - Add minimal structured logger (or `console` wrapper) for Inngest steps.
   - Ensure `DEV_LOG.md` entry lists files changed and issues.

## Mock code (illustrative, keep real code tighter)

```ts
// src/lib/prompts/character.ts
const styleTokens = {
  watercolor: "soft watercolor wash, subtle grain",
  storybook: "storybook classic, warm tones, gentle line",
  anime: "anime clean lines, bright eyes, cel shading",
  flat: "flat illustration, bold shapes, minimal shading",
  "colored-pencil": "colored pencil texture, visible strokes",
};

export function buildCharacterPrompt(profile: CharacterProfile, style: keyof typeof styleTokens) {
  return [
    "Child portrait, friendly lighting, full body",
    profile.color_palette?.length ? `palette: ${profile.color_palette.join(", ")}` : null,
    profile.do_not_change?.map((p) => `keep ${p}`).join("; "),
    styleTokens[style],
  ]
    .filter(Boolean)
    .join(" | ");
}
```

```ts
// src/inngest/functions/generate-character.ts (outline)
export const generateCharacter = inngest.createFunction(
  { id: "generate-character" },
  { event: "character/created" },
  async ({ event, step }) => {
    const characterId = event.data.id;

    const profile = await step.run("vision-profile", () =>
      openai.visionProfile(event.data.sourceImageUrl)
    );

    await step.run("store-profile", () =>
      db.insert(characterProfiles).values({ characterId, ...profile })
    );

    const prompt = buildCharacterPrompt(profile, event.data.style);

    const image = await step.run("replicate-generate", () =>
      replicate.runNanoBanana({ prompt, image: event.data.sourceImageUrl })
    );

    const imageUrl = await step.run("persist-image", () =>
      copyFromTempUrl(image.tempUrl, `characters/${characterId}/${image.id}.png`)
    );

    await step.run("record-image", () =>
      db.insert(characterImages).values({ characterId, imageUrl })
    );

    await step.run("mark-ready", () =>
      db.update(characters).set({ status: "ready" }).where(eq(characters.id, characterId))
    );
  }
);
```

## Definition of done (Phase 2)
- Migrations applied; schema matches plan.
- R2 helpers work locally (unit tests green).
- Inngest functions deploy/run locally; mock tests pass.
- Admin character UI can create a character, trigger generation, display variants.
- All new tests (unit/component/E2E) pass.
- `DEV_LOG.md` updated with actions, files, problems/resolutions.
