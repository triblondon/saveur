import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db";
import { saveSnapshotHtml } from "@/lib/object-storage";
import {
  buildSearchBlob,
  createImportedRecipeRecord,
  createImportRunRecord,
  createManualRecipeRecord,
  updateRecipeFromDraft
} from "@/lib/store-shared";
import type {
  CookStep,
  Ingredient,
  ImportRun,
  ImportStatus,
  PrepTask,
  Recipe,
  RecipeCreateInput,
  RecipeSummary,
  SourceSnapshot,
  SourceType
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

interface RecipeRow {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  hero_photo_url: string | null;
  serving_count: number | string | null;
  time_required_minutes: number | null;
  tags: unknown;
  source_type: SourceType;
  source_ref: string;
  import_prompt: string | null;
  import_run_id: string | null;
  ingredients: unknown;
  prep_tasks: unknown;
  cook_steps: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RecipeSummaryRow {
  id: string;
  title: string;
  hero_photo_url: string | null;
  serving_count: number | string | null;
  time_required_minutes: number | null;
  tags: unknown;
  source_type: SourceType;
  updated_at: Date | string;
}

interface ImportRunRow {
  id: string;
  owner_id: string | null;
  source_type: SourceType;
  source_url: string;
  adapter_name: string;
  adapter_version: string;
  snapshot_id: string | null;
  status: ImportStatus;
  usable: boolean;
  confidence_overall: number | string | null;
  warnings: unknown;
  error_message: string | null;
  created_at: Date | string;
}

interface SourceSnapshotRow {
  id: string;
  source_url: string;
  storage_key: string;
  content_type: string;
  fetched_at: Date | string;
  fetch_status: "OK" | "FAILED";
}

function nowIso(): string {
  return new Date().toISOString();
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseInteger(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function parseNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function asIngredients(value: unknown): Ingredient[] {
  return Array.isArray(value) ? (value as Ingredient[]) : [];
}

function asPrepTasks(value: unknown): PrepTask[] {
  return Array.isArray(value) ? (value as PrepTask[]) : [];
}

function asCookSteps(value: unknown): CookStep[] {
  return Array.isArray(value) ? (value as CookStep[]) : [];
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    importPrompt: row.import_prompt,
    description: row.description,
    tags: asStringArray(row.tags),
    timeRequiredMinutes: row.time_required_minutes,
    servingCount: parseInteger(row.serving_count),
    heroPhotoUrl: row.hero_photo_url,
    importRunId: row.import_run_id,
    ingredients: asIngredients(row.ingredients),
    prepTasks: asPrepTasks(row.prep_tasks),
    cookSteps: asCookSteps(row.cook_steps),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at)
  };
}

function toRecipeSummary(row: RecipeSummaryRow): RecipeSummary {
  return {
    id: row.id,
    title: row.title,
    heroPhotoUrl: row.hero_photo_url,
    timeRequiredMinutes: row.time_required_minutes,
    servingCount: parseInteger(row.serving_count),
    sourceType: row.source_type,
    tags: asStringArray(row.tags),
    updatedAt: asIso(row.updated_at)
  };
}

function toImportRun(row: ImportRunRow): ImportRun {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    adapterName: row.adapter_name,
    adapterVersion: row.adapter_version,
    snapshotId: row.snapshot_id,
    status: row.status,
    usable: row.usable,
    confidenceOverall: parseNumber(row.confidence_overall),
    warnings: asStringArray(row.warnings),
    errorMessage: row.error_message,
    createdAt: asIso(row.created_at)
  };
}

function toSnapshot(row: SourceSnapshotRow): SourceSnapshot {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    storageKey: row.storage_key,
    contentType: row.content_type,
    fetchedAt: asIso(row.fetched_at),
    fetchStatus: row.fetch_status
  };
}

async function insertOrUpdateRecipe(
  queryFn: typeof query,
  recipe: Recipe,
  timestamp: string
): Promise<void> {
  const sql = `
    INSERT INTO recipes (
      id,
      owner_id,
      title,
      description,
      hero_photo_url,
      serving_count,
      time_required_minutes,
      tags,
      source_type,
      source_ref,
      import_prompt,
      import_run_id,
      ingredients,
      prep_tasks,
      cook_steps,
      search_blob,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::jsonb,
      $9,
      $10,
      $11,
      $12,
      $13::jsonb,
      $14::jsonb,
      $15::jsonb,
      $16,
      $17::timestamptz,
      $18::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      hero_photo_url = EXCLUDED.hero_photo_url,
      serving_count = EXCLUDED.serving_count,
      time_required_minutes = EXCLUDED.time_required_minutes,
      tags = EXCLUDED.tags,
      source_type = EXCLUDED.source_type,
      source_ref = EXCLUDED.source_ref,
      import_prompt = EXCLUDED.import_prompt,
      import_run_id = EXCLUDED.import_run_id,
      ingredients = EXCLUDED.ingredients,
      prep_tasks = EXCLUDED.prep_tasks,
      cook_steps = EXCLUDED.cook_steps,
      search_blob = EXCLUDED.search_blob,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;

  await queryFn(sql, [
    recipe.id,
    recipe.ownerId,
    recipe.title,
    recipe.description,
    recipe.heroPhotoUrl,
    recipe.servingCount,
    recipe.timeRequiredMinutes,
    JSON.stringify(recipe.tags),
    recipe.sourceType,
    recipe.sourceRef,
    recipe.importPrompt,
    recipe.importRunId,
    JSON.stringify(recipe.ingredients),
    JSON.stringify(recipe.prepTasks),
    JSON.stringify(recipe.cookSteps),
    buildSearchBlob(recipe),
    recipe.createdAt,
    timestamp
  ]);
}

export type ManualRecipeInput = RecipeCreateInput;

export async function listRecipeSummaries(queryText?: string): Promise<RecipeSummary[]> {
  const baseSelect = `
    SELECT id, title, hero_photo_url, serving_count, time_required_minutes, tags, source_type, updated_at
    FROM recipes
  `;

  if (!queryText?.trim()) {
    const result = await query<RecipeSummaryRow>(`${baseSelect} ORDER BY updated_at DESC`);
    return result.rows.map(toRecipeSummary);
  }

  const needle = `%${normalizeSearch(queryText)}%`;
  const result = await query<RecipeSummaryRow>(
    `${baseSelect} WHERE search_blob ILIKE $1 ORDER BY updated_at DESC`,
    [needle]
  );

  return result.rows.map(toRecipeSummary);
}

export async function listRecipes(queryText?: string): Promise<Recipe[]> {
  if (!queryText?.trim()) {
    const result = await query<RecipeRow>(
      `SELECT * FROM recipes ORDER BY updated_at DESC`
    );
    return result.rows.map(toRecipe);
  }

  const needle = `%${normalizeSearch(queryText)}%`;
  const result = await query<RecipeRow>(
    `SELECT * FROM recipes WHERE search_blob ILIKE $1 ORDER BY updated_at DESC`,
    [needle]
  );

  return result.rows.map(toRecipe);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const result = await query<RecipeRow>(`SELECT * FROM recipes WHERE id = $1 LIMIT 1`, [id]);
  const row = result.rows[0];
  return row ? toRecipe(row) : null;
}

export async function getImportRunById(id: string): Promise<ImportRun | null> {
  const result = await query<ImportRunRow>(`SELECT * FROM import_runs WHERE id = $1 LIMIT 1`, [id]);
  const row = result.rows[0];
  return row ? toImportRun(row) : null;
}

export async function createManualRecipe(input: ManualRecipeInput): Promise<Recipe> {
  const timestamp = nowIso();
  const recipe = createManualRecipeRecord({
    input,
    recipeId: randomUUID(),
    ownerId: null,
    timestamp
  });

  await insertOrUpdateRecipe(query, recipe, timestamp);
  return recipe;
}

export async function updateRecipe(
  id: string,
  updates: Partial<Omit<Recipe, "id" | "createdAt">>
): Promise<Recipe | null> {
  const existing = await getRecipeById(id);
  if (!existing) {
    return null;
  }

  const timestamp = nowIso();
  const next: Recipe = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: timestamp
  };

  await insertOrUpdateRecipe(query, next, timestamp);
  return next;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM recipes WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function saveSourceSnapshot(sourceUrl: string, html: string): Promise<SourceSnapshot> {
  const snapshotId = randomUUID();
  const storageKey = `snapshots/${snapshotId}.html`;

  await saveSnapshotHtml(storageKey, html);

  const result = await query<SourceSnapshotRow>(
    `
      INSERT INTO source_snapshots (
        id,
        source_url,
        storage_key,
        content_type,
        fetched_at,
        fetch_status
      ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6)
      RETURNING *
    `,
    [snapshotId, sourceUrl, storageKey, "text/html", nowIso(), "OK"]
  );

  return toSnapshot(result.rows[0]);
}

interface CreateImportedRecipeInput {
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  importPrompt?: string | null;
}

export async function createImportedRecipe(input: CreateImportedRecipeInput): Promise<{
  recipe: Recipe;
  importRun: ImportRun;
}> {
  const timestamp = nowIso();
  const importRun = createImportRunRecord({
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    draft: input.draft,
    id: randomUUID(),
    ownerId: null,
    createdAt: timestamp
  });
  const recipe = createImportedRecipeRecord({
    draft: input.draft,
    sourceUrl: input.sourceUrl,
    importPrompt: input.importPrompt?.trim() || null,
    importRunId: importRun.id,
    recipeId: randomUUID(),
    ownerId: null,
    createdAt: timestamp
  });

  await withTransaction(async (tx) => {
    await tx(
      `
        INSERT INTO import_runs (
          id,
          owner_id,
          source_type,
          source_url,
          adapter_name,
          adapter_version,
          snapshot_id,
          status,
          usable,
          confidence_overall,
          warnings,
          error_message,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::timestamptz
        )
      `,
      [
        importRun.id,
        importRun.ownerId,
        importRun.sourceType,
        importRun.sourceUrl,
        importRun.adapterName,
        importRun.adapterVersion,
        importRun.snapshotId,
        importRun.status,
        importRun.usable,
        importRun.confidenceOverall,
        JSON.stringify(importRun.warnings),
        importRun.errorMessage,
        importRun.createdAt
      ]
    );

    await insertOrUpdateRecipe(tx, recipe, timestamp);
  });

  return { recipe, importRun };
}

interface ReimportRecipeInput {
  recipeId: string;
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  importPrompt?: string | null;
}

export async function reimportRecipe(input: ReimportRecipeInput): Promise<{
  recipe: Recipe;
  importRun: ImportRun;
} | null> {
  const timestamp = nowIso();

  return withTransaction(async (tx) => {
    const existingResult = await tx<RecipeRow>(
      `SELECT * FROM recipes WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [input.recipeId]
    );

    const existingRow = existingResult.rows[0];
    if (!existingRow) {
      return null;
    }

    const existing = toRecipe(existingRow);

    const importRun = createImportRunRecord({
      sourceUrl: input.sourceUrl,
      adapterName: input.adapterName,
      adapterVersion: input.adapterVersion,
      snapshotId: input.snapshotId,
      draft: input.draft,
      id: randomUUID(),
      ownerId: existing.ownerId,
      createdAt: timestamp
    });

    const next = updateRecipeFromDraft(existing, {
      draft: input.draft,
      sourceUrl: input.sourceUrl,
      importPrompt: input.importPrompt?.trim() || null,
      importRunId: importRun.id,
      updatedAt: timestamp
    });

    await tx(
      `
        INSERT INTO import_runs (
          id,
          owner_id,
          source_type,
          source_url,
          adapter_name,
          adapter_version,
          snapshot_id,
          status,
          usable,
          confidence_overall,
          warnings,
          error_message,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::timestamptz
        )
      `,
      [
        importRun.id,
        importRun.ownerId,
        importRun.sourceType,
        importRun.sourceUrl,
        importRun.adapterName,
        importRun.adapterVersion,
        importRun.snapshotId,
        importRun.status,
        importRun.usable,
        importRun.confidenceOverall,
        JSON.stringify(importRun.warnings),
        importRun.errorMessage,
        importRun.createdAt
      ]
    );

    await insertOrUpdateRecipe(tx, next, timestamp);

    return {
      recipe: next,
      importRun
    };
  });
}

export async function listImportRuns(): Promise<ImportRun[]> {
  const result = await query<ImportRunRow>(`SELECT * FROM import_runs ORDER BY created_at DESC`);
  return result.rows.map(toImportRun);
}
