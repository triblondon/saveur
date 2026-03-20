# Saveur Plan (Current State + Next Steps)

## 1. Goal and success

Build a mobile-first recipe web app that can import online recipes into a clean, cook-friendly format.

Primary success metrics:
- Import accuracy for Gousto recipes.
- Number of recipes saved from Gousto.

Secondary quality goals:
- Fast editability of imported recipes.
- Reliable timers and wake lock while cooking.
- Low operational cost (free-tier friendly where possible).

## 2. What is implemented now

### Product scope
- Multi-source URL import path (single LLM pipeline, not source-specific scrapers).
- Manual recipe creation and full editing.
- Recipe list/search and recipe detail view.
- Recipe hero image upload.
- Prep tasks and cook steps with markdown detail rendering.
- Per-step timers with concurrent running timers and sticky off-screen timer chips.
- Wake lock support with a page-header indicator when active.
- QR-code scan in Import URL view.
- Per-recipe shopping checklist checkboxes with local persistence and expiry cleanup.

### Import architecture (implemented)
- `POST /api/import/url` fetches source HTML and stores snapshot.
- Import uses one OpenAI Responses API call (`src/lib/import/llm-import.ts`).
- Structured output is constrained by JSON Schema derived from `openapi/openapi.yaml`.
- Output model includes:
  - metadata
  - ingredients (including pantry flag)
  - prep tasks
  - cook steps
  - confidence
  - warnings
- Reimport is supported with optional custom prompt.
- Reimport UI displays warnings from the previous import run.

### Persistence architecture (implemented)
- Primary: Postgres (`DATABASE_URL` set).
- Fallback: file store (`data/store.json`) when DB is not configured.
- Recipe content is stored on `recipes` as JSONB arrays for ingredients/prep/cook.
- `import_runs` records adapter/model, status, usability, confidence, and warnings.
- HTML snapshots are persisted via object storage integration.
- Hero photos are stored in object storage.

### API contract (implemented)
- `GET /api/recipes`
- `POST /api/recipes`
- `GET /api/recipes/{id}`
- `PUT /api/recipes/{id}` (full replace)
- `DELETE /api/recipes/{id}`
- `POST /api/import/url`
- `POST /api/recipes/{id}/reimport`
- `POST /api/recipes/{id}/photo`

### UI and UX (implemented)
- Home page with search and responsive card grid.
- Recipe view layout with:
  - persistent site header
  - hero image + metadata block
  - ingredients table
  - pantry list
  - prep tasks
  - cook steps
  - recipe actions
- Ingredients include shopping checkboxes persisted locally per recipe.
- When any ingredient is checked, UI shows:
  - “Shopping checkmarks are cleared after a week. [Clear now]”.
- Edit and new recipe flows use the same structured form controls.

## 3. Key decisions reflected in implementation

- No auth in phase 1; data model remains auth-ready via nullable `owner_id`.
- LLM-first import replaces brittle site-specific parser adapters.
- No feedback-learning subsystem in phase 1 (removed).
- Import quality tuning is done via “reimport with prompt” + warning visibility.
- iOS target UX with web-standard tech only (no iOS-only proprietary stack).

## 4. Current gaps vs original brief

- iOS share-sheet "Share to Saveur" entry is not yet implemented.
- No offline mode (explicitly deferred).
- No nutrition/macros (deferred).
- No auth/multi-user permissions (deferred).

## 5. Next steps (priority order)

1. Add iOS-friendly share flow:
   - support URL prefill on `/import?url=...`
   - provide an iOS Shortcut-based share action now
   - consider a thin native wrapper with Share Extension later if first-class inbound sharing is required
2. Add import observability dashboard queries (import counts, usable rate, warning frequency).
3. Expand import QA fixtures for Gousto/BBC pages and add regression checks.
4. Add optional error monitoring (Sentry) once deployment stabilizes.

## 6. Non-goals for phase 1

- OCR/book-photo import.
- Cross-recipe shopping aggregation.
- Collaborative editing.
- Complex taxonomy for tags.
