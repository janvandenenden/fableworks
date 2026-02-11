# Personalized Children's Books Platform — Implementation Plan

## Context

Build a platform where parents create personalized children's books — a child becomes the protagonist of an AI-illustrated story, delivered as a PDF or printed book. The system has two surfaces: a user-facing book creation flow and an admin tool for story/asset management. This plan covers all 8 phases from project setup through internal fulfillment and customer commerce.

**Key technology choices:**

- **Next.js 15** (App Router) + **shadcn/ui** + **Tailwind CSS**
- **Drizzle ORM** + **PostgreSQL** (SQLite for local dev)
- **Cloudflare R2** for object storage
- **Clerk** for auth, **Vercel** for hosting
- **Inngest** for background jobs
- **OpenAI API** (text + vision), **Replicate API** (image generation)
  - NanoBanana: `google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8`
  - NanoBanana Pro: `google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3`
- **Stripe** for payments, **Lulu API** for print-on-demand
- **Zustand** for client-side multi-step flow state
- **Vitest** for unit/component tests, **Playwright** for E2E tests

**Static assets:**

- `public/outline.png` — Character outline template used as structural reference in storyboard generation

---

## Project Structure

```
personalized-books/
├── src/
│   ├── app/
│   │   ├── (marketing)/          # Landing page, public routes
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (app)/                # User-facing authenticated routes
│   │   │   ├── create/
│   │   │   │   ├── character/page.tsx
│   │   │   │   ├── story/page.tsx
│   │   │   │   ├── checkout/page.tsx
│   │   │   │   └── generating/page.tsx
│   │   │   ├── books/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── layout.tsx
│   │   ├── admin/                # Admin routes
│   │   │   ├── page.tsx          # Dashboard
│   │   │   ├── characters/
│   │   │   ├── stories/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── props/page.tsx
│   │   │   │   │   ├── storyboard/page.tsx
│   │   │   │   │   └── pages/page.tsx
│   │   │   └── playground/page.tsx
│   │   ├── api/
│   │   │   ├── inngest/route.ts
│   │   │   ├── webhooks/
│   │   │   │   ├── replicate/route.ts
│   │   │   │   └── stripe/route.ts
│   │   │   └── upload/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── admin/                # Admin-specific components
│   │   ├── create/               # Book creation flow components
│   │   └── shared/               # Shared components
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (all tables)
│   │   ├── index.ts              # DB connection
│   │   └── migrations/
│   ├── lib/
│   │   ├── openai.ts             # OpenAI client
│   │   ├── replicate.ts          # Replicate client
│   │   ├── r2.ts                 # R2 upload/download helpers
│   │   ├── stripe.ts             # Stripe client
│   │   ├── lulu.ts               # Lulu API client
│   │   ├── prompts/              # Prompt templates
│   │   │   ├── character.ts
│   │   │   ├── story.ts
│   │   │   ├── props.ts
│   │   │   ├── storyboard.ts
│   │   │   └── final-page.ts
│   │   └── utils.ts
│   ├── inngest/
│   │   ├── client.ts             # Inngest client
│   │   └── functions/
│   │       ├── generate-character.ts
│   │       ├── generate-story.ts
│   │       ├── generate-props.ts
│   │       ├── generate-storyboard.ts
│   │       ├── generate-final-pages.ts
│   │       ├── generate-pdf.ts
│   │       └── persist-replicate-output.ts
│   ├── stores/
│   │   └── create-book.ts        # Zustand store for creation flow
│   └── middleware.ts              # Clerk auth middleware
├── src/test/
│   ├── setup.ts                  # Vitest global setup
│   ├── mocks/                    # Shared mocks (OpenAI, Replicate, R2, Inngest)
│   │   ├── openai.ts
│   │   ├── replicate.ts
│   │   ├── r2.ts
│   │   └── inngest.ts
│   └── fixtures/                 # Test data factories
│       ├── characters.ts
│       ├── stories.ts
│       └── orders.ts
├── e2e/                          # Playwright E2E tests
│   ├── admin-playground.spec.ts
│   ├── character-creation.spec.ts
│   ├── story-generation.spec.ts
│   ├── book-creation-flow.spec.ts
│   └── checkout.spec.ts
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .env.local
├── .env.test                     # Test-specific env overrides
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## Database Schema

All tables use Drizzle ORM. Defined in `src/db/schema.ts`.

### Core Tables

```
users
  id              text PK (Clerk user ID)
  email           text NOT NULL
  role            text DEFAULT 'customer'   -- 'admin' | 'customer'
  created_at      timestamp DEFAULT now()

characters
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         text FK → users.id
  name            text NOT NULL
  gender          text NOT NULL             -- 'male' | 'female' | 'neutral'
  source_image_url text                     -- R2 URL of uploaded photo
  style_preset    text                      -- 'watercolor' | 'anime' | 'storybook' | etc.
  status          text DEFAULT 'draft'      -- 'draft' | 'generating' | 'ready'
  created_at      timestamp DEFAULT now()
  updated_at      timestamp DEFAULT now()

character_profiles
  id              uuid PK
  character_id    uuid FK → characters.id UNIQUE
  approx_age      text                      -- 'toddler' | 'young_child' | 'older_child'
  hair_color      text
  hair_length     text
  hair_texture    text
  hair_style      text
  face_shape      text
  eye_color       text
  eye_shape       text
  skin_tone       text
  clothing        text
  distinctive_features text
  color_palette   jsonb                     -- string[]
  personality_traits jsonb                  -- string[]
  do_not_change   jsonb                     -- string[] invariants
  raw_vision_description text              -- Full OpenAI Vision output

character_images
  id              uuid PK
  character_id    uuid FK → characters.id
  image_url       text NOT NULL             -- R2 URL
  is_selected     boolean DEFAULT false
  prompt_artifact_id uuid FK → prompt_artifacts.id
  created_at      timestamp DEFAULT now()

stories
  id              uuid PK
  user_id         text FK → users.id
  character_id    uuid FK → characters.id
  title           text
  age_range       text                      -- 'toddler' | '3-5' | '6-8'
  theme           text
  story_arc       text                      -- LLM-generated arc summary
  status          text DEFAULT 'draft'      -- 'draft' | 'scenes_ready' | 'props_ready' |
                                            --  'storyboard_ready' | 'pages_ready' | 'complete'
  created_at      timestamp DEFAULT now()
  updated_at      timestamp DEFAULT now()

story_scenes
  id              uuid PK
  story_id        uuid FK → stories.id
  scene_number    integer NOT NULL
  spread_text     text                      -- The story text for this spread
  scene_description text                    -- Visual description for image gen
  layout          text DEFAULT 'full-spread' -- 'full-spread' | 'left-image' | 'right-image'
  created_at      timestamp DEFAULT now()
  updated_at      timestamp DEFAULT now()

props_bible_entries
  id              uuid PK
  story_id        uuid FK → stories.id
  title           text NOT NULL
  category        text                      -- 'object' | 'environment' | 'element'
  tags            jsonb                     -- string[]
  description     text NOT NULL             -- Detailed textual definition
  created_at      timestamp DEFAULT now()
  updated_at      timestamp DEFAULT now()

prop_images
  id              uuid PK
  prop_id         uuid FK → props_bible_entries.id
  image_url       text NOT NULL
  variant_label   text                      -- e.g. 'front', 'side', 'detail'
  prompt_artifact_id uuid FK → prompt_artifacts.id
  created_at      timestamp DEFAULT now()

storyboard_panels
  id              uuid PK
  scene_id        uuid FK → story_scenes.id
  background      text                      -- Description
  foreground      text
  environment     text
  character_pose  text                      -- Explicit pose/action
  composition     text                      -- e.g. 'bird-eye', 'medium-shot', 'rule-of-thirds'
  props_used      jsonb                     -- uuid[] refs to props_bible_entries
  image_url       text                      -- R2 URL of storyboard sketch
  prompt_artifact_id uuid FK → prompt_artifacts.id
  status          text DEFAULT 'pending'
  created_at      timestamp DEFAULT now()

final_pages
  id              uuid PK
  scene_id        uuid FK → story_scenes.id
  image_url       text NOT NULL
  prompt_artifact_id uuid FK → prompt_artifacts.id
  is_approved     boolean DEFAULT false
  version         integer DEFAULT 1
  created_at      timestamp DEFAULT now()

prompt_artifacts
  id              uuid PK
  entity_type     text NOT NULL             -- 'character' | 'story' | 'storyboard' | 'page' | 'prop'
  entity_id       uuid NOT NULL             -- Polymorphic ref
  raw_prompt      text NOT NULL
  structured_fields jsonb                   -- Any structured inputs
  model           text                      -- Model name/ID used
  parameters      jsonb                     -- Temperature, seed, etc.
  status          text DEFAULT 'pending'    -- 'pending' | 'running' | 'success' | 'failed'
  result_url      text                      -- URL of generated output
  error_message   text
  cost_cents      integer                   -- Estimated cost tracking
  created_at      timestamp DEFAULT now()

generated_assets
  id              uuid PK
  type            text NOT NULL             -- 'character' | 'storyboard' | 'page' | 'pdf' | 'prop'
  entity_id       uuid                      -- Polymorphic ref to source entity
  storage_url     text NOT NULL             -- R2 URL
  mime_type       text
  width           integer
  height          integer
  file_size_bytes integer
  metadata        jsonb
  created_at      timestamp DEFAULT now()

orders
  id              uuid PK
  user_id         text FK → users.id
  story_id        uuid FK → stories.id
  stripe_checkout_session_id text
  stripe_payment_intent_id text
  payment_status  text DEFAULT 'pending'    -- 'pending' | 'paid' | 'failed' | 'refunded'
  amount_cents    integer
  currency        text DEFAULT 'usd'
  created_at      timestamp DEFAULT now()

books
  id              uuid PK
  order_id        uuid FK → orders.id
  pdf_url         text                      -- R2 URL
  lulu_print_job_id text
  print_status    text                      -- 'not_requested' | 'submitted' | 'printing' | 'shipped'
  tracking_url    text
  created_at      timestamp DEFAULT now()
  updated_at      timestamp DEFAULT now()
```

### R2 Bucket Organization

```
personalized-books-assets/
├── uploads/                    # Raw user uploads
│   └── {user_id}/{character_id}/original.{ext}
├── characters/                 # Generated character images
│   └── {character_id}/{image_id}.png
├── storyboards/                # Storyboard sketches
│   └── {story_id}/{scene_number}.png
├── props/                      # Prop reference images
│   └── {story_id}/{prop_id}/{variant}.png
├── pages/                      # Final illustrated pages
│   └── {story_id}/{scene_number}_v{version}.png
└── books/                      # Generated PDFs
    └── {story_id}/{book_id}.pdf
```

---

## Phase 1 — Project Setup

**Goal:** Clean foundation with working API connectivity and admin playground.

### Steps

1. **Initialize project**

   ```
   npx create-next-app@latest personalized-books --typescript --tailwind --eslint --app --src-dir
   ```

2. **Install core dependencies**
   - `shadcn/ui` (init + add button, card, input, select, textarea, dialog, tabs, badge, skeleton, progress, toast)
   - `openai` — OpenAI SDK
   - `replicate` — Replicate SDK
   - `drizzle-orm`, `drizzle-kit` — ORM (installed now, schema in Phase 2)
   - `inngest` — Background jobs
   - `zustand` — Client state
   - `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — R2 access
   - `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` — Unit/component testing
   - `@playwright/test` — E2E testing

3. **Environment variables** (`.env.local`)

   ```
   OPENAI_API_KEY=
   REPLICATE_API_TOKEN=
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET_NAME=
   R2_PUBLIC_URL=
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   DATABASE_URL=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   INNGEST_EVENT_KEY=
   INNGEST_SIGNING_KEY=
   ```

4. **Basic layout + routing**
   - `src/app/layout.tsx` — Root layout with ClerkProvider (wraps all)
   - `src/app/admin/layout.tsx` — Admin sidebar layout
   - `src/app/admin/page.tsx` — Admin dashboard (placeholder)
   - `src/app/admin/playground/page.tsx` — Prompt playground

5. **API client wrappers** (`src/lib/`)
   - `openai.ts` — Singleton OpenAI client
   - `replicate.ts` — Singleton Replicate client, helper to run predictions. Model IDs:
     - NanoBanana: `google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8`
     - NanoBanana Pro: `google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3`
   - `r2.ts` — S3Client configured for R2, upload/download/presigned URL helpers

6. **Admin playground page**
   - Textarea for prompt input
   - Model selector (OpenAI text / OpenAI vision / Replicate)
   - "Generate" button → calls Server Action
   - Displays result (text or image)
   - No persistence yet — purely for testing API connectivity

7. **Testing infrastructure**
   - `vitest.config.ts` — Vitest config with React plugin, jsdom environment, path aliases
   - `playwright.config.ts` — Playwright config pointing at localhost:3000
   - `src/test/setup.ts` — Global test setup (Testing Library matchers, env stubs)
   - `src/test/mocks/openai.ts` — Mock OpenAI client returning canned responses
   - `src/test/mocks/replicate.ts` — Mock Replicate client returning canned image URLs
   - `src/test/mocks/r2.ts` — Mock R2 helpers (in-memory storage)
   - `package.json` scripts: `test`, `test:watch`, `test:coverage`, `test:e2e`

### Phase 1 Tests

- `src/lib/__tests__/openai.test.ts` — Client instantiation, error handling
- `src/lib/__tests__/replicate.test.ts` — Client instantiation, prediction helper
- `src/lib/__tests__/r2.test.ts` — Upload/download/presigned URL helpers (mocked S3)
- `e2e/admin-playground.spec.ts` — Playground page loads, form submits, result displays

### Files Created

- `src/app/layout.tsx`, `src/app/globals.css`
- `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- `src/app/admin/playground/page.tsx`
- `src/lib/openai.ts`, `src/lib/replicate.ts`, `src/lib/r2.ts`
- `src/app/admin/playground/actions.ts` (Server Actions for playground)
- `src/components/ui/` (shadcn components)
- `.env.local`, `.env.test`, `next.config.ts`
- `vitest.config.ts`, `playwright.config.ts`
- `src/test/setup.ts`, `src/test/mocks/openai.ts`, `src/test/mocks/replicate.ts`, `src/test/mocks/r2.ts`
- `src/lib/__tests__/openai.test.ts`, `src/lib/__tests__/replicate.test.ts`, `src/lib/__tests__/r2.test.ts`
- `e2e/admin-playground.spec.ts`

---

## Phase 2 — Database + Character Generation

### 2.1 Database + Storage

1. **Drizzle setup**
   - `src/db/schema.ts` — Full schema as defined above
   - `src/db/index.ts` — Connection setup (postgres for prod, better-sqlite3 for local dev based on `DATABASE_URL`)
   - `drizzle.config.ts` — Migration config
   - Run `drizzle-kit generate` and `drizzle-kit migrate`

2. **R2 storage helpers** (expand `src/lib/r2.ts`)
   - `uploadToR2(buffer, key, contentType)` → returns public URL
   - `getPresignedUploadUrl(key)` → for client-direct uploads
   - `copyFromTempUrl(sourceUrl, destKey)` → fetches from Replicate temp URL, uploads to R2

3. **Inngest setup**
   - `src/inngest/client.ts` — Inngest client initialization
   - `src/app/api/inngest/route.ts` — Inngest serve endpoint
   - `src/inngest/functions/persist-replicate-output.ts` — Copies Replicate temp URLs to R2

### 2.2 Character Generation Flow

**Admin UI:** `src/app/admin/characters/` pages

**Flow:**

1. User uploads child's photo → stored in R2 (`uploads/{user_id}/{character_id}/original`)
2. Selects name, gender, style preset
3. Clicks "Generate" → triggers Inngest function `generate-character`

**Inngest function: `generate-character`** (multi-step)

- **Step 1:** Call OpenAI Vision with the uploaded image → extract structured character profile (age, hair, face, skin, clothing, distinctive features)
- **Step 2:** Store character profile in `character_profiles` table
- **Step 3:** Build image generation prompt from profile + style preset (prompts in `src/lib/prompts/character.ts`)
- **Step 4:** Call Replicate NanoBanana (`google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8`) image-to-image with source image + prompt
- **Step 5:** Copy result from Replicate temp URL to R2
- **Step 6:** Store in `character_images` table, update character status to 'ready'

**Style presets** (defined in `src/lib/prompts/character.ts`):

- Watercolor, Storybook Classic, Anime/Manga, Flat Illustration, Colored Pencil
- Each preset = a set of style tokens appended to the image generation prompt

**Re-roll:** Clicking "Re-roll" triggers the same Inngest function again with the same inputs but creates a new `character_images` row. User can pick their favorite.

**Admin UI components:**

- `src/components/admin/character-form.tsx` — Upload + name/gender/style form
- `src/components/admin/character-gallery.tsx` — Grid of generated variants
- `src/components/admin/character-profile-view.tsx` — Shows structured profile data

### Phase 2 Tests

- `src/db/__tests__/schema.test.ts` — Validate schema types, default values, relations
- `src/lib/prompts/__tests__/character.test.ts` — Prompt builder produces correct output for each style preset, includes all profile fields
- `src/inngest/functions/__tests__/generate-character.test.ts` — Multi-step function with mocked OpenAI/Replicate: vision extraction, profile storage, image gen trigger
- `src/inngest/functions/__tests__/persist-replicate-output.test.ts` — Copies temp URL to R2, stores correct DB rows
- `src/test/fixtures/characters.ts` — Factory functions for character/profile test data
- `e2e/character-creation.spec.ts` — Upload photo, fill form, submit, see generated character

### Files Created/Modified

- `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`
- `src/inngest/client.ts`, `src/inngest/functions/generate-character.ts`, `src/inngest/functions/persist-replicate-output.ts`
- `src/app/api/inngest/route.ts`
- `src/app/api/upload/route.ts` — Handles image upload to R2
- `src/app/admin/characters/page.tsx`, `src/app/admin/characters/new/page.tsx`, `src/app/admin/characters/[id]/page.tsx`
- `src/app/admin/characters/actions.ts` — Server Actions
- `src/components/admin/character-form.tsx`, `character-gallery.tsx`, `character-profile-view.tsx`
- `src/lib/prompts/character.ts`
- `src/db/__tests__/schema.test.ts`, `src/lib/prompts/__tests__/character.test.ts`
- `src/inngest/functions/__tests__/generate-character.test.ts`, `persist-replicate-output.test.ts`
- `src/test/fixtures/characters.ts`, `src/test/mocks/inngest.ts`
- `e2e/character-creation.spec.ts`

---

## Phase 3 — Story Generation

**Goal:** Generate high-quality stories with editable prompts and scene breakdown.

**Admin UI:** `src/app/admin/stories/`

**Flow:**

1. Admin selects an age range + theme (dropdown or custom text)
2. Clicks "Generate Story" → triggers Inngest function `generate-story`

**Inngest function: `generate-story`** (multi-step)

- **Step 1:** Build story prompt with name placeholder {{name}}, age, theme, target age range. Prompt emphasizes: emotional arc, implicit lesson, avoids moralistic tone, feels "authored" not "generated". (Prompts in `src/lib/prompts/story.ts`)
- **Step 2:** Call OpenAI (GPT-4o) → get structured JSON response:
  ```json
  {
    "title": "...",
    "arc_summary": "...",
    "scenes": [
      {
        "scene_number": 1,
        "spread_text": "...",
        "scene_description": "...",
        "layout": "full-spread"
      }
    ]
  }
  ```
- **Step 3:** Store story + scenes in DB, update status to `scenes_ready`

**Editable prompts:** Before generating, the admin can view and edit the system prompt and user prompt in a side panel. The raw prompt is saved as a `prompt_artifact`.

**Scene editing:** After generation, each scene's text and description are individually editable. Single scenes can be regenerated via a "Regenerate Scene" button which calls OpenAI with the surrounding scene context.

**Admin UI components:**

- `src/components/admin/story-form.tsx` — Age range + theme selection
- `src/components/admin/story-editor.tsx` — Full story view with editable scenes
- `src/components/admin/prompt-editor.tsx` — Reusable prompt editing side panel (used across phases)
- `src/components/admin/scene-card.tsx` — Individual scene display with edit/regenerate actions

### Phase 3 Tests

- `src/lib/prompts/__tests__/story.test.ts` — Story prompt builder: correct character interpolation, age-appropriate language constraints, scene structure validation
- `src/inngest/functions/__tests__/generate-story.test.ts` — Mocked OpenAI returns structured JSON, scenes stored correctly, status updated
- `src/components/admin/__tests__/scene-card.test.tsx` — Renders scene text, edit mode toggle, save calls action
- `src/components/admin/__tests__/prompt-editor.test.tsx` — Displays prompts, edit saves, reset works
- `src/test/fixtures/stories.ts` — Factory functions for story/scene test data
- `e2e/story-generation.spec.ts` — Select character, choose theme, generate story, edit a scene, regenerate

### Files Created

- `src/app/admin/stories/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `src/app/admin/stories/actions.ts`
- `src/inngest/functions/generate-story.ts`
- `src/lib/prompts/story.ts`
- `src/components/admin/story-form.tsx`, `story-editor.tsx`, `prompt-editor.tsx`, `scene-card.tsx`
- `src/lib/prompts/__tests__/story.test.ts`
- `src/inngest/functions/__tests__/generate-story.test.ts`
- `src/components/admin/__tests__/scene-card.test.tsx`, `prompt-editor.test.tsx`
- `src/test/fixtures/stories.ts`
- `e2e/story-generation.spec.ts`

---

## Phase 4 — Props Bible Creation

**Goal:** Extract and define recurring visual elements for consistency.

**Admin UI:** `src/app/admin/stories/[id]/props/page.tsx`

**Flow:**

1. After story scenes are ready, admin clicks "Generate Props Bible"
2. Inngest function `generate-props` analyzes all scenes

**Inngest function: `generate-props`** (multi-step)

- **Step 1:** Send all scene descriptions to OpenAI → extract recurring objects, environments, elements
- **Step 2:** For each extracted prop, generate a detailed textual definition (appearance, color, size, material, distinguishing features)
- **Step 3:** Store in `props_bible_entries` table
- **Step 4 (optional):** For key props, generate reference images via Replicate → store in `prop_images`

**Admin UI components:**

- `src/components/admin/props-bible.tsx` — List of all props with edit/delete
- `src/components/admin/prop-card.tsx` — Single prop with description + reference images
- `src/components/admin/prop-form.tsx` — Add/edit prop manually

**Props are editable:** Admin can add, remove, or modify props and their descriptions. Props are referenced by ID in storyboard prompts.

### Phase 4 Tests

- `src/lib/prompts/__tests__/props.test.ts` — Props extraction prompt includes all scene descriptions, output schema validation
- `src/inngest/functions/__tests__/generate-props.test.ts` — Extracts props from scene descriptions, stores entries, optional image generation
- `src/components/admin/__tests__/prop-form.test.tsx` — Add/edit prop form validation, submit calls action
- `src/components/admin/__tests__/props-bible.test.tsx` — Renders prop list, delete removes entry

### Files Created

- `src/app/admin/stories/[id]/props/page.tsx`
- `src/app/admin/stories/[id]/props/actions.ts`
- `src/inngest/functions/generate-props.ts`
- `src/lib/prompts/props.ts`
- `src/components/admin/props-bible.tsx`, `prop-card.tsx`, `prop-form.tsx`
- `src/lib/prompts/__tests__/props.test.ts`
- `src/inngest/functions/__tests__/generate-props.test.ts`
- `src/components/admin/__tests__/prop-form.test.tsx`, `props-bible.test.tsx`

---

## Phase 5 — Storyboard Generation

**Goal:** Define visual composition before final art.

**Admin UI:** `src/app/admin/stories/[id]/storyboard/page.tsx`

**Flow:**

1. After props bible is ready, admin clicks "Generate Storyboard"
2. First, OpenAI generates structured composition data per scene
3. Then, Replicate (NanoBanana Pro) generates B&W sketch per scene

**Inngest function: `generate-storyboard`** (multi-step)

- **Step 1:** For each scene, call OpenAI to generate structured composition:
  - Background, foreground, environment descriptions
  - Character pose/action (explicit)
  - Composition type (bird's-eye, medium shot, etc.)
  - Which props from the bible appear
- **Step 2:** Store composition data in `storyboard_panels`
- **Step 3:** For each panel, build image prompt combining:
  - Scene description + composition
  - Props bible descriptions for referenced props
  - `public/outline.png` as placeholder character outline (not the final character)
  - Style: "loose black-and-white sketch, minimal detail"
- **Step 4:** Call Replicate NanoBanana Pro (`google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3`) per panel
- **Step 5:** Copy results to R2, update `storyboard_panels` with image URLs

**Per-scene regeneration:** Each panel can be regenerated independently. Admin can edit the composition fields and prompt before regenerating.

**Admin UI components:**

- `src/components/admin/storyboard-view.tsx` — Grid of all panels
- `src/components/admin/storyboard-panel.tsx` — Single panel with image + composition editor
- `src/components/admin/composition-form.tsx` — Edit background/foreground/pose/composition

### Phase 5 Tests

- `src/lib/prompts/__tests__/storyboard.test.ts` — Storyboard prompt includes scene + props references, composition fields, sketch style tokens
- `src/inngest/functions/__tests__/generate-storyboard.test.ts` — Composition generation per scene, image gen calls, R2 persistence
- `src/components/admin/__tests__/composition-form.test.tsx` — Form fields render, validation, save updates panel
- `src/components/admin/__tests__/storyboard-panel.test.tsx` — Displays image + composition, regenerate button triggers action

### Files Created

- `src/app/admin/stories/[id]/storyboard/page.tsx`
- `src/app/admin/stories/[id]/storyboard/actions.ts`
- `src/inngest/functions/generate-storyboard.ts`
- `src/lib/prompts/storyboard.ts`
- `src/components/admin/storyboard-view.tsx`, `storyboard-panel.tsx`, `composition-form.tsx`
- `src/lib/prompts/__tests__/storyboard.test.ts`
- `src/inngest/functions/__tests__/generate-storyboard.test.ts`
- `src/components/admin/__tests__/composition-form.test.tsx`, `storyboard-panel.test.tsx`

---

## Phase 6 — Final Book Page Generation

**Goal:** Produce final illustrated pages with visual consistency.

**Admin UI:** `src/app/admin/stories/[id]/pages/page.tsx`

**Flow:**

1. After storyboard is approved, admin clicks "Generate Final Pages"
2. Each page combines: storyboard panel + character image + props bible + style definition

**Inngest function: `generate-final-pages`** (multi-step)

- **Step 1:** For each scene, build the final prompt combining:
  - Storyboard panel (composition reference)
  - Final character image (selected variant from Phase 2)
  - Character profile description + do_not_change invariants
  - Props bible entries for referenced props
  - Style preset tokens (from character's chosen style)
  - Color palette from character profile
- **Step 2:** Call Replicate NanoBanana (`google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8`) image-to-image per page
  - Use storyboard panel as the structural reference
  - Use character image as the character reference
- **Step 3:** Copy results to R2, store in `final_pages`
- **Step 4:** Update story status to `pages_ready`

**Re-roll individual pages:** Each page can be regenerated independently without affecting others. Creates a new version (`version` field increments).

**Admin UI components:**

- `src/components/admin/final-pages-view.tsx` — Side-by-side storyboard vs final
- `src/components/admin/final-page-card.tsx` — Single page with approve/re-roll actions

### Phase 6 Tests

- `src/lib/prompts/__tests__/final-page.test.ts` — Final prompt combines storyboard + character + props + style correctly, invariants included
- `src/inngest/functions/__tests__/generate-final-pages.test.ts` — Per-page image gen, version increment on re-roll, status update
- `src/components/admin/__tests__/final-page-card.test.tsx` — Approve/re-roll buttons, version display, side-by-side comparison

### Files Created

- `src/app/admin/stories/[id]/pages/page.tsx`
- `src/app/admin/stories/[id]/pages/actions.ts`
- `src/inngest/functions/generate-final-pages.ts`
- `src/lib/prompts/final-page.ts`
- `src/components/admin/final-pages-view.tsx`, `final-page-card.tsx`
- `src/lib/prompts/__tests__/final-page.test.ts`
- `src/inngest/functions/__tests__/generate-final-pages.test.ts`
- `src/components/admin/__tests__/final-page-card.test.tsx`

---

## Phase 7 — Internal Fulfillment (PDF + Manual Print)

### 7.1 PDF Generation

**Inngest function: `generate-pdf`**

- Uses `@react-pdf/renderer` to compose final pages + text into a children's book layout
- Stores PDF in R2
- Updates `books` table with `pdf_url`

**Components:**

- `src/lib/pdf/book-template.tsx` — React-PDF template defining book layout (cover, spreads, back)
- `src/lib/pdf/spread-layout.tsx` — Single spread layout component

### 7.2 Internal Book Review + Download

- Admin can review generated book output before customer rollout.
- Download button for PDF is available for internal QA/print checks.
- Internal review route can be admin-only during this phase.

### 7.3 Lulu Print-on-Demand (Manual Trigger)

**Manual internal flow:**

1. Admin triggers print submission from an internal page.
2. Lulu client submits print job with generated PDF URL.
3. `books` row stores `lulu_print_job_id` + print status.
4. Admin can refresh or poll job status to track production/shipping.

**Components**
- `src/lib/lulu.ts` — Lulu API client (create print job, get status, shipping rates).
- `src/app/admin/books/[id]/page.tsx` (or equivalent) — internal print controls and status UI.

### Phase 7 Tests

- `src/inngest/functions/__tests__/generate-pdf.test.ts` — PDF generation with mocked React-PDF, R2 upload, book row created.
- `src/lib/__tests__/lulu.test.ts` — print job creation, status polling, error handling.
- `src/app/admin/books/__tests__/print-actions.test.ts` — manual print trigger and status refresh behavior.

### Files Created

- `src/lib/pdf/book-template.tsx`, `spread-layout.tsx`
- `src/inngest/functions/generate-pdf.ts`
- `src/lib/lulu.ts`
- `src/app/admin/books/page.tsx`, `[id]/page.tsx` (or equivalent internal fulfillment routes)
- `src/inngest/functions/__tests__/generate-pdf.test.ts`
- `src/lib/__tests__/lulu.test.ts`
- `src/app/admin/books/__tests__/print-actions.test.ts`

---

## Phase 8 — Customer Commerce UX (Stripe + Buyer Flow)

### 8.1 Customer-Facing Creation Flow

Multi-step flow managed by Zustand store (`src/stores/create-book.ts`):

```
Step 1: Create Character → /create/character
Step 2: Select Story     → /create/story
Step 3: Checkout         → /create/checkout
Step 4: Generation       → /create/generating (progress tracking)
Step 5: View Book        → /books/[id]
```

`/create/generating` tracks fulfillment progress with customer-friendly status updates.

### 8.2 Stripe Checkout + Webhook

**Flow**
1. User completes character + story selection.
2. Server Action creates Stripe Checkout Session.
3. User pays via Stripe-hosted checkout.
4. Stripe webhook confirms payment and updates order state (`paid`).
5. Paid order transitions into fulfillment pipeline.

**Components**
- `src/app/(app)/create/checkout/page.tsx`
- `src/app/(app)/create/checkout/actions.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/stripe.ts`

### 8.3 Customer Book Library + Status Tracking

- `src/app/(app)/books/page.tsx` — purchased/generated books list.
- `src/app/(app)/books/[id]/page.tsx` — book detail with download and print/delivery status.
- Hide all admin generation complexity from customer UI.

### Phase 8 Tests

- `src/lib/__tests__/stripe.test.ts` — checkout session creation, webhook signature verification, event handling.
- `src/stores/__tests__/create-book.test.ts` — step transitions, state persistence, reset.
- `src/components/create/__tests__/step-indicator.test.tsx` — active/completed/upcoming step states.
- `src/components/create/__tests__/progress-step.test.tsx` — progress status updates and completion.
- `src/test/fixtures/orders.ts` — order/book fixtures for commerce flows.
- `e2e/book-creation-flow.spec.ts` — full user flow to checkout.
- `e2e/checkout.spec.ts` — Stripe test checkout + webhook simulation.

### Files Created

- `src/app/(app)/books/page.tsx`, `[id]/page.tsx`
- `src/app/(app)/create/character/page.tsx`, `story/page.tsx`, `checkout/page.tsx`, `generating/page.tsx`
- `src/app/(app)/create/actions.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/stripe.ts`
- `src/stores/create-book.ts`
- `src/components/create/character-step.tsx`, `story-step.tsx`, `checkout-step.tsx`, `progress-step.tsx`, `step-indicator.tsx`
- `src/lib/__tests__/stripe.test.ts`
- `src/stores/__tests__/create-book.test.ts`
- `src/components/create/__tests__/step-indicator.test.tsx`, `progress-step.test.tsx`
- `src/test/fixtures/orders.ts`
- `e2e/book-creation-flow.spec.ts`, `e2e/checkout.spec.ts`

---

## Clerk Auth Setup

- `src/middleware.ts` — Clerk middleware protecting `/admin/*` (admin role check) and `/create/*`, `/books/*` (any authenticated user)
- Admin routes require `role: 'admin'` in Clerk metadata
- Phase 1-5: No auth enforced (admin-only development)
- Phase 8: Enable Clerk auth for user-facing routes

---

## Background Job Summary (Inngest Functions)

| Function                   | Trigger              | Steps                                  | Phase |
| -------------------------- | -------------------- | -------------------------------------- | ----- |
| `generate-character`       | Character created    | Vision → Profile → Image Gen → Persist | 2     |
| `persist-replicate-output` | Replicate webhook    | Copy temp URL → R2                     | 2     |
| `generate-story`           | Story requested      | Build prompt → OpenAI → Store scenes   | 3     |
| `generate-props`           | Props requested      | Analyze scenes → Extract props → Store | 4     |
| `generate-storyboard`      | Storyboard requested | Composition → Image gen per panel      | 5     |
| `generate-final-pages`     | Pages requested      | Build prompts → Image gen per page     | 6     |
| `generate-pdf`             | All pages approved   | Compose PDF → Store in R2              | 7     |

---

## Testing Strategy

### Frameworks

- **Vitest** — Unit tests, component tests (with React Testing Library), screenshot/visual debugging via browser mode
- **Playwright** — E2E tests for critical user flows against a running dev server

### Test Infrastructure (set up in Phase 1)

| File                          | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `vitest.config.ts`            | Vitest config: React plugin, jsdom, path aliases, coverage thresholds |
| `playwright.config.ts`        | Playwright config: base URL, browser settings, test directory         |
| `src/test/setup.ts`           | Global setup: Testing Library matchers, env stubs                     |
| `src/test/mocks/openai.ts`    | Mock OpenAI client (canned text + vision responses)                   |
| `src/test/mocks/replicate.ts` | Mock Replicate client (canned image URLs)                             |
| `src/test/mocks/r2.ts`        | Mock R2 helpers (in-memory buffer storage)                            |
| `src/test/mocks/inngest.ts`   | Mock Inngest client (captures sent events, step spies)                |
| `src/test/fixtures/*.ts`      | Factory functions for test data (characters, stories, orders)         |
| `.env.test`                   | Test-specific env overrides (dummy API keys, test DB URL)             |

### What Gets Tested Per Phase

| Phase | Unit Tests (Vitest)                         | Component Tests (Vitest)              | E2E Tests (Playwright)           |
| ----- | ------------------------------------------- | ------------------------------------- | -------------------------------- |
| 1     | API client wrappers (OpenAI, Replicate, R2) | --                                    | Playground page loads + submits  |
| 2     | Schema validation, character prompt builder | Character form, gallery, profile view | Upload photo, generate character |
| 3     | Story prompt builder, scene structure       | Scene card, prompt editor             | Generate story, edit scene       |
| 4     | Props extraction prompt                     | Prop form, props bible list           | --                               |
| 5     | Storyboard prompt builder                   | Composition form, storyboard panel    | --                               |
| 6     | Final page prompt builder                   | Final page card                       | --                               |
| 7     | PDF generator, Lulu client                  | Internal print controls               | Admin fulfillment smoke flow      |
| 8     | Stripe helpers, Zustand commerce store      | Step indicator, progress step         | Full creation flow, checkout      |

### Bug Fixing Protocol

When a bug is found:

1. Write a failing test that reproduces the bug
2. Confirm the test fails for the expected reason
3. Fix the bug
4. Confirm the test passes
5. Commit test + fix together

### Coverage Targets

- `src/lib/` — 80% minimum
- `src/db/` — 80% minimum
- `src/inngest/functions/` — 70% minimum (Inngest step functions are harder to unit test)
- `src/components/` — 60% minimum
- Overall project — 70% minimum

### Per-Phase Manual Verification

Automated tests cover logic and integration. Manual verification is for **visual quality** and **AI output review**:

- **Phase 1:** Playground returns coherent text from OpenAI. Replicate generates a visible image.
- **Phase 2:** Generated character looks like the uploaded photo in the chosen style. Profile fields are accurate.
- **Phase 3:** Story reads naturally, age-appropriate, has emotional arc. Scenes flow logically.
- **Phase 4:** Props bible captures the right recurring elements. Descriptions are detailed enough for image gen.
- **Phase 5:** Storyboard sketches match scene descriptions. Composition feels right.
- **Phase 6:** Final pages are visually consistent across spreads. Character looks the same throughout.
- **Phase 7:** PDF layout is clean. Lulu sandbox accepts the manual print job and status updates.
- **Phase 8:** Stripe test payment completes. Customer creation -> checkout -> library flow is smooth.

### Running Tests

```bash
npm run test               # Run Vitest (unit + component tests)
npm run test:watch         # Vitest in watch mode
npm run test:coverage      # Vitest with coverage report
npm run test:e2e           # Run Playwright E2E tests
npx playwright test --ui   # Playwright with interactive UI
```

### Running the Project

```bash
cd personalized-books
npm run dev                # Start Next.js dev server
npx inngest-cli@latest dev # Start Inngest dev server (for local job processing)
npx drizzle-kit studio     # Optional: DB browser
```
