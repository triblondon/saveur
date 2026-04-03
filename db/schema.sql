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
  CREATE TYPE collection_visibility AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE collection_member_role AS ENUM ('COLLABORATOR', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  visibility collection_visibility NOT NULL DEFAULT 'private',
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_members (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role collection_member_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, user_id)
);

CREATE INDEX IF NOT EXISTS collection_members_user_idx ON collection_members (user_id);
CREATE INDEX IF NOT EXISTS collections_owner_idx ON collections (owner_user_id);
CREATE INDEX IF NOT EXISTS collections_updated_idx ON collections (updated_at DESC);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY,
  owner_id UUID NULL,
  created_by_user_id UUID NULL,
  collection_id UUID NULL,
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

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS collection_id UUID NULL;

UPDATE recipes
SET created_by_user_id = owner_id
WHERE created_by_user_id IS NULL
  AND owner_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE recipes
    ADD CONSTRAINT recipes_created_by_user_fk
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE recipes
    ADD CONSTRAINT recipes_collection_fk
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
  created_by_user_id UUID NULL,
  source_type source_type NOT NULL,
  source_url TEXT NOT NULL,
  adapter_name TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  snapshot_id UUID NULL REFERENCES source_snapshots(id) ON DELETE SET NULL,
  status import_status NOT NULL,
  usable BOOLEAN NOT NULL,
  confidence_overall NUMERIC NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT import_runs_warnings_array CHECK (jsonb_typeof(warnings) = 'array')
);

ALTER TABLE import_runs
  ADD COLUMN IF NOT EXISTS warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL;

UPDATE import_runs
SET created_by_user_id = owner_id
WHERE created_by_user_id IS NULL
  AND owner_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_created_by_user_fk
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS recipes_updated_idx ON recipes(updated_at DESC);
CREATE INDEX IF NOT EXISTS recipes_search_blob_idx ON recipes(search_blob);
CREATE INDEX IF NOT EXISTS recipes_search_blob_trgm_idx ON recipes USING GIN (search_blob gin_trgm_ops);
CREATE INDEX IF NOT EXISTS recipes_collection_idx ON recipes(collection_id);
CREATE INDEX IF NOT EXISTS import_runs_created_idx ON import_runs(created_at DESC);
