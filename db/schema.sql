-- Saveur schema for Neon Postgres

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('URL', 'SCAN', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE import_status AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM ('EDIT', 'ADD', 'REMOVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY,
  owner_id UUID NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  hero_photo_url TEXT NULL,
  serving_count INTEGER NULL,
  time_required_minutes INTEGER NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_type source_type NOT NULL,
  source_ref TEXT NOT NULL,
  import_prompt TEXT NULL,
  import_run_id UUID NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  prep_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  cook_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_blob TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recipes_tags_array CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT recipes_ingredients_array CHECK (jsonb_typeof(ingredients) = 'array'),
  CONSTRAINT recipes_prep_tasks_array CHECK (jsonb_typeof(prep_tasks) = 'array'),
  CONSTRAINT recipes_cook_steps_array CHECK (jsonb_typeof(cook_steps) = 'array')
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id UUID PRIMARY KEY,
  source_url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  fetch_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_runs (
  id UUID PRIMARY KEY,
  owner_id UUID NULL,
  source_type source_type NOT NULL,
  source_url TEXT NOT NULL,
  adapter_name TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  snapshot_id UUID NULL REFERENCES source_snapshots(id) ON DELETE SET NULL,
  status import_status NOT NULL,
  usable BOOLEAN NOT NULL,
  confidence_overall NUMERIC NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_feedback (
  id UUID PRIMARY KEY,
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  original_value JSONB NULL,
  final_value JSONB NULL,
  feedback_type feedback_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipes_updated_idx ON recipes(updated_at DESC);
CREATE INDEX IF NOT EXISTS recipes_search_blob_idx ON recipes(search_blob);
CREATE INDEX IF NOT EXISTS import_runs_created_idx ON import_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS import_feedback_run_idx ON import_feedback(import_run_id);
