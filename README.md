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
- `src/lib/store.ts`: persistence facade (Neon Postgres when `DATABASE_URL` is set, file fallback otherwise)
- `src/app/api/*`: API routes
- `src/app/*`: basic UI routes
- `db/schema.sql`: Neon Postgres schema

## Run locally

1. Install dependencies:
   - `npm install`
2. Set env vars:
   - `OPENAI_API_KEY=...`
   - optional `OPENAI_IMPORT_MODEL=...` (defaults to `gpt-4.1`)
3. Start dev server:
   - `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

## Notes

- If `DATABASE_URL` is not set, local file persistence is used (`data/store.json`) for fast iteration.
- If `DATABASE_URL` is set, recipes/import runs/feedback/snapshots are persisted in Postgres.
- Source snapshots and recipe photo uploads use GCS when `GCS_BUCKET` is set.

## Vercel + Neon + GCS setup

1. Neon
   - Create a Neon project and copy the pooled connection string into `DATABASE_URL`.
   - Run schema migration: `npm run db:migrate`
2. GCS
   - Create a bucket and set `GCS_BUCKET`.
   - Add service account credentials in `GOOGLE_APPLICATION_CREDENTIALS_JSON` (raw JSON or base64-encoded JSON).
   - For browser-visible image URLs, configure bucket/object public-read and optionally set `GCS_PUBLIC_BASE_URL`.
3. Vercel
   - Import the repo.
   - Add environment variables from `.env.example`.
   - Deploy and run `npm run db:migrate` against production DB before first import.
