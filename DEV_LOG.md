# Fableworks Development Log

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

### Actions
- Added character prompt builder with style presets (`src/lib/prompts/character.ts`) and tests.
- Added Inngest client (`src/inngest/client.ts`), persist-replicate-output function, and function registry.
- Added Inngest Next.js route handler (`src/app/api/inngest/route.ts`).
- Added `generate-character` Inngest function to run vision, store profile, generate art via Replicate, persist image, and update status.
- Added admin characters list + detail pages and server action to create characters and fire generation events.
- Added upload API route that returns presigned R2 upload URLs.
- Added initial unit test for `generate-character` Inngest function with mocked dependencies.
- Updated character form to upload a child photo to R2 and store the public URL using `{userId}/{characterId}` key structure.
- Switched upload flow to send file through `/api/upload` (server-side upload) to avoid browser CORS issues with presigned URLs.
- Improved upload route error reporting and blob handling to diagnose form-data issues.
- Normalized character creation to avoid setting `userId` when running locally without users, preventing FK failures.
- Updated character creation to proceed even if Inngest event send fails, and route to detail page on success.
- Fixed Next.js dynamic params handling for character detail route (awaited `params`).
- Added character detail UI to show profile fields, status badge, and generated image gallery.
- Fixed SQLite binding errors by serializing JSON arrays before inserting character profiles.
