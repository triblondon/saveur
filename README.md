# Saveur

Saveur is a mobile-first recipe app for importing recipes from web pages and cooking from a clean, distraction-free view.

## Highlights

- Next.js + TypeScript app (App Router)
- LLM-driven URL import pipeline for all sources
- Structured import output validated with OpenAPI-derived JSON Schema
- Manual create/edit and full recipe CRUD
- Hero photo upload + display
- Ingredients, prep tasks, and cook steps
- Concurrent cook-step timers + wake lock support
- QR code scanning in URL import view
- Per-recipe shopping checklist persisted on device (auto-clears after a week)

## Import approach

`POST /api/import/url` performs one OpenAI Responses API call that:
1. Reviews the source URL content (including mirror markdown + HTML snippet context)
2. Produces strict JSON output matching `RecipeFromLlmImport`
3. Returns recipe metadata, ingredients, prep tasks, cook steps, confidence, and warnings

The import schema is sourced from `openapi/openapi.yaml` and resolved at runtime.

## Data + storage

- Postgres is used when `DATABASE_URL` is set.
- File persistence fallback is used otherwise (`data/store.json`).
- Recipe content (ingredients/prep/cook) is stored as JSONB arrays on `recipes`.
- Import runs are stored in `import_runs` including warnings.
- Source snapshots are stored in Vercel Blob when configured, otherwise `data/snapshots`.
- Hero photos (including imported remote hero images) are stored in Vercel Blob when configured, otherwise local filesystem under `data/objects` and served by `/api/storage/...`.
- In local development (`NODE_ENV=development`), filesystem storage is used by default.

## Local development

1. Install dependencies
   - `npm install`
2. Configure env
   - `OPENAI_API_KEY=...`
   - optional `OPENAI_IMPORT_MODEL=...` (default: `gpt-4.1`)
   - optional `DATABASE_URL=...` (for Postgres mode)
   - optional `BLOB_READ_WRITE_TOKEN=...` (for Vercel Blob in non-local environments)
3. Run migrations when using Postgres
   - `npm run db:migrate`
4. Start app
   - `npm run dev`

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - production server
- `npm run typecheck` - TypeScript checks
- `npm run test` - smoke tests
- `npm run generate:types` - regenerate OpenAPI TypeScript types
- `npm run db:migrate` - apply SQL schema to configured Postgres

## Deployment (Vercel + Neon + Vercel Blob)

1. Provision Neon and set `DATABASE_URL`.
2. Provision Vercel Blob and set `BLOB_READ_WRITE_TOKEN`.
3. Deploy on Vercel with environment variables from `.env.example`.
4. Run `npm run db:migrate` against production DB before first imports.
