# Saveur Phase 1 Plan

## 1. Goal and success

Build a mobile-friendly recipe app that imports Gousto recipes into a clean cooking format with minimal manual cleanup.

Success criteria:
- Primary: Gousto imports are usually usable without major edits.
- Proxy metric: number of Gousto recipes saved over time.
- Secondary: recipe list/search, shopping checkboxes, prep tasks, and cook timers are reliable on iOS Safari and modern mobile browsers.

Non-goals for Phase 1:
- Authentication (deferred, but schema is auth-ready).
- Offline support.
- Multi-recipe shopping aggregation.
- Nutrition/macros.
- Advanced observability (Sentry deferred).

## 2. Product decisions locked

- Users: you + partner, shared library.
- Auth: no auth in Phase 1; add nullable `owner_id` now for future Auth0.
- Source priority: Gousto first; BBC later.
- Import behavior: partial auto-fill on parse failure, then manual edit.
- Source retention: store raw source HTML snapshot for imported URLs.
- Learning loop: capture manual edit diffs from imported drafts when feasible.
- Ingredient quantities: support exact text + normalized values when parseable.
- Scaling: nearest whole number for whole-item ingredients.
- Prep model: unordered `prep_tasks` (tasks, not strict sequence).
- Cook model: ordered `cook_steps`; cook steps may reference prep tasks.
- Shopping: per-recipe ingredient checkbox state only (ephemeral/local).
- Photos: single hero image via object storage.
- Deployment priority: simplest developer experience with usage-based billing.

## 3. Suggested stack

- App framework: Next.js (TypeScript), App Router.
- Runtime: serverless deployment (Railway/Render with managed Postgres and object storage integration).
- Database: Postgres.
- ORM/migrations: Prisma (or Drizzle; Prisma preferred for velocity).
- Search: Postgres trigram + `ILIKE` fuzzy matching (ingredients + tags + title).
- Storage:
  - Recipe photos: object storage bucket.
  - HTML snapshots: object storage bucket (or DB `TEXT` initially if very small; prefer object storage).
- Timers/wakelock:
  - Browser Web APIs (`WakeLock`, `setTimeout`, visibility-aware UI).

Provider selection heuristic:
- Choose the host with easiest deploy workflow for Next.js + Postgres under ~`$10/month` target and free-tier-friendly usage.

## 4. Architecture

### 4.1 Components

- Web app (SSR + client interactions).
- API routes for recipes/import/search/upload.
- Import pipeline:
  - fetch URL
  - store raw snapshot
  - parse via source adapter (`gousto`)
  - persist draft recipe + parse confidence
  - hand off to edit UI
- Parser feedback writer:
  - when imported draft is edited and saved, record structured field diffs.

### 4.2 Import adapter design

Use adapter interface per source:

- `canHandle(url): boolean`
- `parse(html, url): ParsedRecipeDraft`
- `parserVersion: string`

Phase 1 only implements `gousto` adapter.
BBC adapter scaffold exists but returns unsupported for now.

### 4.3 Data flow

1. User submits URL.
2. Server fetches HTML.
3. Save snapshot + import run record.
4. Run Gousto parser into draft structure.
5. Save draft recipe with confidence/flags.
6. User reviews/edits and saves.
7. If imported draft changed, save field-level feedback.

## 5. Data model (Phase 1)

### 5.1 Core tables

- `recipes`
  - `id` (uuid)
  - `owner_id` (uuid, nullable)
  - `title` (text)
  - `source_type` (`URL | SCAN | MANUAL`)
  - `source_ref` (text)
  - `description` (text, nullable)
  - `time_required_minutes` (int, nullable)
  - `serving_count` (numeric, nullable)
  - `hero_photo_url` (text, nullable)
  - `import_run_id` (uuid, nullable)
  - `created_at`, `updated_at`

- `ingredients`
  - `id` (uuid)
  - `recipe_id` (uuid fk)
  - `position` (int)
  - `name` (text)
  - `quantity_text` (text, nullable)          # supports fractions/ranges/to taste
  - `quantity_value` (numeric, nullable)      # normalized numeric if parseable
  - `quantity_min` (numeric, nullable)        # for ranges
  - `quantity_max` (numeric, nullable)        # for ranges
  - `unit` (text/enum, nullable)
  - `is_whole_item` (boolean default false)
  - `optional` (boolean default false)

- `prep_tasks`
  - `id` (uuid)
  - `recipe_id` (uuid fk)
  - `position` (int)                          # stable display order only
  - `instruction` (text)
  - `detail` (text, nullable)

- `cook_steps`
  - `id` (uuid)
  - `recipe_id` (uuid fk)
  - `position` (int)                          # ordered sequence
  - `instruction` (text)
  - `detail` (text, nullable)
  - `timer_seconds` (int, nullable)

- `cook_step_prep_task_refs`
  - `cook_step_id` (uuid fk)
  - `prep_task_id` (uuid fk)

- `tags`
  - `id` (uuid)
  - `name` (text unique, canonical lowercased)

- `recipe_tags`
  - `recipe_id` (uuid fk)
  - `tag_id` (uuid fk)

### 5.2 Import and feedback tables

- `source_snapshots`
  - `id` (uuid)
  - `source_url` (text)
  - `storage_key` (text)
  - `content_type` (text)
  - `fetched_at` (timestamp)
  - `fetch_status` (text)

- `import_runs`
  - `id` (uuid)
  - `owner_id` (uuid, nullable)
  - `source_type` (text)
  - `source_url` (text)
  - `adapter_name` (text)
  - `adapter_version` (text)
  - `snapshot_id` (uuid fk, nullable)
  - `status` (`SUCCESS | PARTIAL | FAILED`)
  - `usable` (boolean)
  - `confidence_overall` (numeric, nullable)
  - `error_message` (text, nullable)
  - `created_at`

- `import_feedback`
  - `id` (uuid)
  - `import_run_id` (uuid fk)
  - `recipe_id` (uuid fk)
  - `field_path` (text)                       # e.g. ingredients[3].quantity_text
  - `original_value` (jsonb)
  - `final_value` (jsonb)
  - `feedback_type` (`EDIT | ADD | REMOVE`)
  - `created_at`

### 5.3 Future-proofing hooks

- `owner_id` nullable now, indexed for future auth rollout.
- Optional nutrition columns deferred; keep room via additive migration later.
- Tag aliases can be added later via `tag_aliases` table.

## 6. API plan

- `POST /api/import/url`
  - input: `{ url }`
  - output: `{ importRunId, recipeId, status, usable }`

- `GET /api/recipes`
  - supports fuzzy query over `title`, ingredients, tags.

- `GET /api/recipes/:id`
- `POST /api/recipes`
- `PUT /api/recipes/:id`
- `DELETE /api/recipes/:id` (optional in Phase 1)

- `POST /api/recipes/:id/photo`
  - presigned upload or direct server proxy upload.

- `POST /api/import/:importRunId/feedback`
  - recorded automatically on save when imported draft changed.

Validation:
- Zod schemas shared across API and forms.

## 7. UI plan

### 7.1 Views

- Home/list view
  - recipe cards with hero photo, title, tags, time.
  - fuzzy search input (ingredient/tag/title).

- Recipe view
  - servings scaler.
  - ingredients list with scaled values.
  - per-ingredient shopping checkbox (client-side ephemeral).
  - prep tasks section (unordered tasks).
  - cook steps section (ordered) with inline timer start.
  - wake lock default-on in cook mode; visible status indicator.

- New recipe
  - URL import path.
  - manual creation path.

- Recipe edit
  - full edit of all sections.
  - clear indication when recipe originated from import.

### 7.2 Scaling rules

- Keep `quantity_text` for display fallback when parsing is ambiguous.
- If `quantity_value` exists:
  - whole-item ingredients (`is_whole_item=true`) round to nearest whole.
  - non-whole units keep reasonable precision (for example 1 decimal) with humanized fractions where possible.

### 7.3 Timers

- Multiple concurrent step timers supported.
- Timer tied to `cook_step.id` and shown as active chips/status.
- Phase 1: in-app timers only, no background/local notifications guarantee.

## 8. Tag strategy (Phase 1)

- Free-text entry allowed.
- Canonicalization:
  - trim/lowercase for storage.
  - preserve display casing on render.
- Soft cleanup:
  - suggest existing tags as user types.
  - optional periodic dedupe script.
- Seed starter tags:
  - proteins, difficulty levels, spice levels.

## 9. Observability and metrics

Logs to capture:
- import started/completed/failed.
- adapter used + version.
- parse outcome (`SUCCESS/PARTIAL/FAILED`) and `usable` flag.
- fields most often corrected in feedback.

Metrics dashboards (simple SQL queries initially):
- Gousto import count by week.
- Usable import rate.
- Top corrected fields.
- Saved recipes count.

## 10. Milestones and deliverables

### Milestone 1: Foundation

Deliver:
- Next.js TypeScript app scaffold.
- Postgres schema + migrations.
- CRUD for recipes/ingredients/prep/cook/tags.
- Home list + recipe detail basic rendering.

Acceptance:
- can create/edit/view/delete recipe manually.
- can search recipes by title/ingredient/tag fuzzily.

### Milestone 2: Gousto import MVP

Deliver:
- URL import endpoint.
- raw snapshot storage.
- Gousto adapter parsing title/ingredients/tasks/steps/timers.
- import run status + confidence persisted.
- draft-to-edit workflow.

Acceptance:
- Gousto URL yields usable draft in most tested cases.
- parser failures still produce partial draft when possible.

### Milestone 3: Cooking UX

Deliver:
- servings scaling rules implemented.
- prep tasks + cook steps UI polished.
- concurrent timers + visible states.
- wake lock default-on indicator in cook mode.

Acceptance:
- whole-item scaling rounds to nearest whole.
- multiple timers run simultaneously and remain accurate while app is active.

### Milestone 4: Feedback learning loop

Deliver:
- field diff capture on imported recipe edits.
- feedback persistence and basic analysis queries.

Acceptance:
- edits after import generate structured feedback rows.
- can identify top parser pain points from stored feedback.

### Milestone 5: Deploy and harden

Deliver:
- production deployment to chosen provider.
- object storage configured.
- basic log monitoring and error surfacing.

Acceptance:
- app and API stable in hosted environment.
- monthly usage expected to fit free tier or stay near budget target.

## 11. Backlog (ticket-sized)

1. Initialize Next.js + TypeScript + linting + format config.
2. Set up Prisma schema and initial migration.
3. Implement recipe CRUD API + validation.
4. Build list/detail/edit/new recipe pages.
5. Implement fuzzy search query and indexes (trigram).
6. Add object storage client + photo upload flow.
7. Build import URL endpoint and snapshot fetch/store.
8. Implement Gousto adapter parser with tests from sample pages.
9. Persist import runs and confidence/usable flags.
10. Implement draft review/edit UX for imported recipes.
11. Add serving scaling engine with whole-item rounding.
12. Add prep task model and cook step refs.
13. Add concurrent timer UI state management.
14. Add wake lock integration with fallback behavior.
15. Capture import feedback diffs on save.
16. Add basic admin/report queries for import quality.
17. Deploy to selected provider and verify env config.

## 12. Risks and mitigations

- Gousto markup changes break parser.
  - Mitigation: adapter versioning, resilient selectors, parser tests with saved fixtures.

- Quantity parsing ambiguity.
  - Mitigation: always keep original text; normalize only when high confidence.

- Timer reliability on mobile tab state.
  - Mitigation: monotonic clock-based timer calculations; clear UX when tab inactive.

- Tag entropy.
  - Mitigation: canonical storage + autocomplete suggestions + later alias table.

## 13. Definition of done for Phase 1

- You can import Gousto URLs and usually get usable recipes.
- You can edit and save recipes quickly when parser misses details.
- You can cook from full-scroll recipe view with wake lock and concurrent timers.
- You can scale servings with sensible rounding for whole items.
- You can search by title/ingredients/tags fuzzily.
- The app is deployed on a simple serverless-friendly platform within budget expectations.
