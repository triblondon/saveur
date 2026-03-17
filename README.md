# Saveur

Saveur is a mobile-first recipe app for importing and cooking recipes without ad-heavy pages.

This repository currently includes:
- A Next.js + TypeScript scaffold
- A single LLM-driven URL import pipeline for all recipe sources
- URL import API with raw HTML snapshot storage
- Basic manual recipe creation, list/search, and recipe cook view
- Wake lock support and concurrent per-step timers
- Import feedback capture when imported recipes are edited

## Import technique

`POST /api/import/url` now performs one OpenAI Responses API call that:
1. Reviews the recipe URL (with web search tool enabled)
2. Uses extracted HTML text as additional context
3. Returns strict JSON schema output for:
   - metadata
   - ingredients
   - prep tasks
   - cooking steps

The output schema includes descriptions, examples, length constraints, and enum constraints.
Unit enum values are sourced from app type defs (`UNIT_OPTIONS` in `src/lib/types.ts`) so schema and app model stay in sync.

## Project layout

- `src/lib/import/llm-import.ts`: single LLM import invocation + JSON schema
- `src/lib/import/index.ts`: URL import orchestration
- `src/lib/store.ts`: local JSON persistence and snapshot file storage
- `src/app/api/*`: API routes
- `src/app/*`: basic UI routes
- `db/schema.sql`: planned Postgres schema

## Run locally

1. Install dependencies:
   - `npm install`
2. Set env vars:
   - `OPENAI_API_KEY=...`
   - optional `OPENAI_IMPORT_MODEL=...` (defaults to `gpt-4.1`)
2. Start dev server:
   - `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000)

## Notes

- Local scaffold persistence is file-based (`data/store.json`) for rapid iteration.
- Production target remains Postgres + object storage as defined in `db/schema.sql` and `PLAN.md`.
- Photo upload endpoint is currently a placeholder (`501`).
