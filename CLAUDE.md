# Fableworks - Personalized Children's Books Platform

## Project Overview

Platform where parents create personalized children's books. A child becomes the protagonist of an AI-illustrated story, delivered as a PDF or printed book. Two surfaces: user-facing book creation flow and admin tool for story/asset management.

**Stack:** Next.js 15 (App Router), shadcn/ui, Tailwind CSS, Drizzle ORM, PostgreSQL (SQLite local dev), Cloudflare R2, Clerk auth, Inngest (background jobs), OpenAI + Replicate (AI generation), Stripe (payments), Lulu (print-on-demand), Zustand (client state).

## Critical Rules

### 1. Code Organization

- Many small files over few large files
- High cohesion, low coupling
- 200-400 lines typical, 800 lines absolute max per file
- Organize by feature/domain, not by type
- Colocate server actions with their route (`actions.ts` next to `page.tsx`)
- Keep prompt templates in `src/lib/prompts/` -- one file per domain

### 2. UI Components

- **Always use shadcn/ui components** before building custom ones
- Check `src/components/ui/` for existing components before creating new ones
- If shadcn has a component for it, use it (Button, Card, Input, Select, Dialog, Tabs, Badge, Skeleton, Progress, Toast, etc.)
- Compose shadcn primitives for complex UI -- do not reinvent dropdowns, modals, or form controls
- Style with Tailwind utility classes, avoid custom CSS unless absolutely necessary

### 3. Code Style

- No emojis in code, comments, or documentation
- Immutability always -- never mutate objects or arrays
- No `console.log` in production code (use structured logging or remove before commit)
- Use `"use client"` directive only when the component genuinely needs client interactivity
- Prefer Server Components by default

### 4. TypeScript

- Strict null checks enabled
- Avoid `any` -- use `unknown` and narrow with type guards when dealing with external data
- `as` casts are acceptable for third-party library boundaries but should not be used to silence type errors in our own code
- Infer types from Drizzle schema using `typeof table.$inferSelect` and `typeof table.$inferInsert`
- Validate external input (API requests, form data, webhooks) with Zod

### 5. Error Handling

All server actions and API helpers return a result object:

```typescript
type ActionResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };
```

Never throw from server actions. Catch internally and return `{ success: false, error: "..." }`. On the client, check `result.success` and show toast on failure.

### 6. Security

- No hardcoded secrets -- all sensitive values in environment variables
- Validate all user inputs with Zod before processing
- Parameterized queries only (Drizzle handles this)
- Verify Stripe webhook signatures
- Verify Clerk session before any authenticated operation
- Never expose internal error details to the client

## Bug Fixing Protocol

**Mandatory: test-first bug fixes.** When you encounter a bug:

1. **Write a failing test first** that reproduces the bug
2. **Run the test** -- confirm it fails for the expected reason
3. **Fix the bug** in the source code
4. **Run the test again** -- the bug is only considered fixed when the test passes
5. Commit the test and the fix together

This creates a strong feedback loop and prevents regressions. No exceptions.

## Testing

### Frameworks

- **Vitest** -- unit tests, component tests, screenshot/visual debugging
- **Playwright** -- E2E tests for critical user flows

### Strategy

- Unit tests for: utilities, prompt builders, Zod schemas, data transformations
- Component tests (Vitest + React Testing Library) for: admin forms, creation flow steps
- E2E tests (Playwright) for: full book creation flow, Stripe checkout, admin workflows
- Use Vitest's browser mode or screenshot capabilities for visual UI debugging
- 80% minimum coverage target for `src/lib/` and `src/db/`

### Test file conventions

- Unit/component tests: `*.test.ts(x)` colocated with source or in `__tests__/`
- E2E tests: `e2e/*.spec.ts`
- Test utilities: `src/test/` directory

## File Structure

```
src/
|-- app/                  # Next.js App Router
|   |-- (marketing)/      # Landing page, public routes
|   |-- (app)/            # User-facing authenticated routes
|   |   |-- create/       # Multi-step book creation flow
|   |   |-- books/        # User's book library
|   |-- admin/            # Admin dashboard, characters, stories, playground
|   |-- api/              # API routes (inngest, webhooks, upload)
|-- components/
|   |-- ui/               # shadcn/ui components (auto-generated)
|   |-- admin/            # Admin-specific components
|   |-- create/           # Book creation flow components
|   |-- shared/           # Shared components
|-- db/
|   |-- schema.ts         # Drizzle schema (all tables)
|   |-- index.ts          # DB connection
|   |-- migrations/       # Generated migrations
|-- lib/
|   |-- openai.ts         # OpenAI client singleton
|   |-- replicate.ts      # Replicate client singleton
|   |-- r2.ts             # R2 storage helpers
|   |-- stripe.ts         # Stripe client
|   |-- lulu.ts           # Lulu API client
|   |-- prompts/          # Prompt templates by domain
|   |-- pdf/              # React-PDF book templates
|   |-- utils.ts          # General utilities
|-- inngest/
|   |-- client.ts         # Inngest client
|   |-- functions/        # Background job definitions
|-- stores/
|   |-- create-book.ts    # Zustand store for creation flow
|-- middleware.ts          # Clerk auth middleware
```

## Database

- ORM: Drizzle with PostgreSQL (prod) / SQLite (local dev)
- Schema defined in `src/db/schema.ts`
- Generate migrations: `npx drizzle-kit generate`
- Apply migrations: `npx drizzle-kit migrate`
- Browse DB: `npx drizzle-kit studio`
- Use `$inferSelect` / `$inferInsert` for type inference from schema

## Environment Variables

```bash
# AI Services
OPENAI_API_KEY=
REPLICATE_API_TOKEN=

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Payments (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Background Jobs (Inngest)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

## Available Commands

```bash
npm run dev                # Start Next.js dev server
npx inngest-cli@latest dev # Start Inngest dev server
npx drizzle-kit studio     # DB browser
npx drizzle-kit generate   # Generate migrations from schema changes
npx drizzle-kit migrate    # Apply migrations
npm run test               # Run Vitest
npm run test:e2e           # Run Playwright
```

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Never commit to main directly
- PRs require review
- All tests must pass before merge
- Commit test + fix together for bug fixes

## Replicate Model IDs

- **NanoBanana** (image-to-image, character gen + final pages): `google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8`
- **NanoBanana Pro** (storyboard sketches): `google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3`

## Static Assets

- `public/outline.png` — Character outline template used as structural reference in storyboard generation (added by user)

## Action Log Discipline

**Before starting any task, read the latest `DEV_LOG.md` entry.** It is the single source of truth for current status, open problems, and decisions. Do not begin work until you've checked it.

**All actions, decisions, and problems must be logged in `DEV_LOG.md`** at the project root.

- Before starting work on a phase or task, add a dated entry stub describing intent
- Log what was done, what files were created/modified, and any problems encountered
- If a problem was solved, log the root cause and the fix
- If a problem is unresolved, mark it clearly so it can be picked up later
- Keep entries concise but specific -- future you (or another developer) should be able to understand what happened and why

**Per-phase planning guardrail:** Before starting any phase, check for a dedicated plan file (e.g., `PHASE2_PLAN.md`). If it’s missing, pause, prompt the user to generate one (plan mode), and commit that plan before implementation work begins.

**Lesson learned (Phase 2):** Replicate’s `run()` may not return final image URLs immediately. Prefer creating a prediction and polling (or handling webhooks) so async generation completes before persisting results. Also normalize JSON outputs and serialize arrays for SQLite.

## Phase Tracking

- [x] Phase 1: Project Setup
- [x] Phase 2: Database + Character Generation
- [x] Phase 3: Story Generation
- [x] Phase 4: Props Bible Creation
- [x] Phase 5: Storyboard Generation
- [x] Phase 6: Final Page Generation
- [ ] Phase 7: Internal Fulfillment (current)
- [ ] Phase 8: Customer Commerce UX (Stripe + Buyer Flow)
