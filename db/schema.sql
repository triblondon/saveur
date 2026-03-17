-- Saveur Phase 1 schema (Postgres)

CREATE TYPE source_type AS ENUM ('URL', 'SCAN', 'MANUAL');
CREATE TYPE import_status AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');
CREATE TYPE feedback_type AS ENUM ('EDIT', 'ADD', 'REMOVE');

CREATE TABLE recipes (
  id UUID PRIMARY KEY,
  owner_id UUID NULL,
  title TEXT NOT NULL,
  source_type source_type NOT NULL,
  source_ref TEXT NOT NULL,
  import_prompt TEXT NULL,
  description TEXT NULL,
  time_required_minutes INT NULL,
  serving_count NUMERIC NULL,
  hero_photo_url TEXT NULL,
  import_run_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingredients (
  id UUID PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  name TEXT NOT NULL,
  quantity_text TEXT NULL,
  quantity_value NUMERIC NULL,
  quantity_min NUMERIC NULL,
  quantity_max NUMERIC NULL,
  unit TEXT NULL,
  is_whole_item BOOLEAN NOT NULL DEFAULT FALSE,
  optional BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE prep_tasks (
  id UUID PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  instruction TEXT NOT NULL,
  detail TEXT NULL
);

CREATE TABLE cook_steps (
  id UUID PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  instruction TEXT NOT NULL,
  detail TEXT NULL,
  timer_seconds INT NULL
);

CREATE TABLE cook_step_prep_task_refs (
  cook_step_id UUID NOT NULL REFERENCES cook_steps(id) ON DELETE CASCADE,
  prep_task_id UUID NOT NULL REFERENCES prep_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (cook_step_id, prep_task_id)
);

CREATE TABLE tags (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE recipe_tags (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE TABLE source_snapshots (
  id UUID PRIMARY KEY,
  source_url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  fetch_status TEXT NOT NULL
);

CREATE TABLE import_runs (
  id UUID PRIMARY KEY,
  owner_id UUID NULL,
  source_type source_type NOT NULL,
  source_url TEXT NOT NULL,
  adapter_name TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  snapshot_id UUID NULL REFERENCES source_snapshots(id),
  status import_status NOT NULL,
  usable BOOLEAN NOT NULL,
  confidence_overall NUMERIC NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_feedback (
  id UUID PRIMARY KEY,
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  original_value JSONB NULL,
  final_value JSONB NULL,
  feedback_type feedback_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX recipes_owner_idx ON recipes(owner_id);
CREATE INDEX recipes_updated_idx ON recipes(updated_at DESC);
CREATE INDEX import_runs_created_idx ON import_runs(created_at DESC);
CREATE INDEX import_feedback_run_idx ON import_feedback(import_run_id);
