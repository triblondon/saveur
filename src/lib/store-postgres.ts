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
  CollectionCreateInput,
  CollectionRole,
  CollectionUpdateInput,
  CookStep,
  ImportRun,
  ImportStatus,
  Ingredient,
  PrepTask,
  Recipe,
  RecipeCreateInput,
  RecipeSummary,
  SourceSnapshot,
  SourceType,
  UserRecord,
  UserSummary
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

interface RecipeRow {
  id: string;
  owner_id: string | null;
  created_by_user_id: string | null;
  collection_id: string | null;
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
  collection_id: string | null;
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
  created_by_user_id: string | null;
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

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  owner_user_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CollectionMemberRow {
  collection_id: string;
  user_id: string;
  role: Exclude<CollectionRole, "OWNER">;
  created_at: Date | string;
}

interface CollectionRecord {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface CollectionMemberRecord {
  collectionId: string;
  userId: string;
  role: Exclude<CollectionRole, "OWNER">;
  createdAt: string;
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    ownerId: row.created_by_user_id ?? row.owner_id ?? null,
    createdByUserId: row.created_by_user_id ?? row.owner_id ?? null,
    collectionId: row.collection_id,
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
    updatedAt: asIso(row.updated_at),
    collectionId: row.collection_id
  };
}

function toImportRun(row: ImportRunRow): ImportRun {
  return {
    id: row.id,
    createdByUserId: row.created_by_user_id ?? row.owner_id ?? null,
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

function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email
  };
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at)
  };
}

function toCollectionRecord(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    ownerUserId: row.owner_user_id,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at)
  };
}

function toCollectionMemberRecord(row: CollectionMemberRow): CollectionMemberRecord {
  return {
    collectionId: row.collection_id,
    userId: row.user_id,
    role: row.role,
    createdAt: asIso(row.created_at)
  };
}

export async function getUserById(id: string): Promise<UserSummary | null> {
  const result = await query<UserRow>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
  const row = result.rows[0];
  return row ? toUserSummary(row) : null;
}

export async function getUserAuthByEmail(email: string): Promise<UserRecord | null> {
  const normalized = normalizeEmail(email);
  const result = await query<UserRow>(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`, [normalized]);
  const row = result.rows[0];
  return row ? toUserRecord(row) : null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserSummary> {
  const timestamp = nowIso();
  const id = randomUUID();
  const email = normalizeEmail(input.email);

  try {
    const result = await query<UserRow>(
      `
        INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)
        RETURNING *
      `,
      [id, input.name.trim(), email, input.passwordHash, timestamp, timestamp]
    );
    return toUserSummary(result.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users_email_lower_idx")) {
      throw new Error("EMAIL_EXISTS");
    }
    throw error;
  }
}

export async function createCollection(ownerUserId: string, input: CollectionCreateInput) {
  const id = randomUUID();
  const timestamp = nowIso();
  const result = await query<CollectionRow>(
    `
      INSERT INTO collections (id, name, description, visibility, owner_user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
      RETURNING *
    `,
    [id, input.name.trim(), input.description, input.visibility, ownerUserId, timestamp, timestamp]
  );
  return toCollectionRecord(result.rows[0]);
}

export async function updateCollection(collectionId: string, input: CollectionUpdateInput) {
  const result = await query<CollectionRow>(
    `
      UPDATE collections
      SET name = $2, description = $3, visibility = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [collectionId, input.name.trim(), input.description, input.visibility]
  );
  return result.rows[0] ? toCollectionRecord(result.rows[0]) : null;
}

export async function getCollectionById(collectionId: string) {
  const result = await query<CollectionRow>(`SELECT * FROM collections WHERE id = $1 LIMIT 1`, [collectionId]);
  return result.rows[0] ? toCollectionRecord(result.rows[0]) : null;
}

export async function listCollections() {
  const result = await query<CollectionRow>(`SELECT * FROM collections ORDER BY updated_at DESC`);
  return result.rows.map(toCollectionRecord);
}

export async function listCollectionMembers(collectionId: string) {
  const result = await query<CollectionMemberRow>(
    `SELECT * FROM collection_members WHERE collection_id = $1`,
    [collectionId]
  );
  return result.rows.map(toCollectionMemberRecord);
}

export async function upsertCollectionMember(
  collectionId: string,
  userId: string,
  role: Exclude<CollectionRole, "OWNER">
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx(
      `
        INSERT INTO collection_members (collection_id, user_id, role, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (collection_id, user_id)
        DO UPDATE SET role = EXCLUDED.role
      `,
      [collectionId, userId, role]
    );
    await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [collectionId]);
  });
}

export async function removeCollectionMember(collectionId: string, userId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx(`DELETE FROM collection_members WHERE collection_id = $1 AND user_id = $2`, [
      collectionId,
      userId
    ]);
    await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [collectionId]);
  });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await query(`DELETE FROM collections WHERE id = $1`, [collectionId]);
}

export async function moveRecipesBetweenCollections(
  sourceCollectionId: string,
  targetCollectionId: string
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx(
      `
        UPDATE recipes
        SET collection_id = $2, updated_at = NOW()
        WHERE collection_id = $1
      `,
      [sourceCollectionId, targetCollectionId]
    );
    await tx(`UPDATE collections SET updated_at = NOW() WHERE id IN ($1, $2)`, [
      sourceCollectionId,
      targetCollectionId
    ]);
  });
}

export async function deleteRecipesByCollection(collectionId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx(`DELETE FROM recipes WHERE collection_id = $1`, [collectionId]);
    await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [collectionId]);
  });
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
      created_by_user_id,
      collection_id,
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
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10::jsonb,
      $11,
      $12,
      $13,
      $14,
      $15::jsonb,
      $16::jsonb,
      $17::jsonb,
      $18,
      $19::timestamptz,
      $20::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      created_by_user_id = EXCLUDED.created_by_user_id,
      collection_id = EXCLUDED.collection_id,
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
    recipe.createdByUserId,
    recipe.createdByUserId,
    recipe.collectionId,
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
    SELECT id, collection_id, title, hero_photo_url, serving_count, time_required_minutes, tags, source_type, updated_at
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
    const result = await query<RecipeRow>(`SELECT * FROM recipes ORDER BY updated_at DESC`);
    return result.rows.map(toRecipe);
  }

  const needle = `%${normalizeSearch(queryText)}%`;
  const result = await query<RecipeRow>(
    `SELECT * FROM recipes WHERE search_blob ILIKE $1 ORDER BY updated_at DESC`,
    [needle]
  );

  return result.rows.map(toRecipe);
}

export async function listRecipesByCollection(collectionId: string): Promise<Recipe[]> {
  const result = await query<RecipeRow>(
    `SELECT * FROM recipes WHERE collection_id = $1 ORDER BY updated_at DESC`,
    [collectionId]
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

export async function createManualRecipe(
  input: ManualRecipeInput & { createdByUserId: string | null; collectionId: string }
): Promise<Recipe> {
  const timestamp = nowIso();
  const recipe = createManualRecipeRecord({
    input,
    recipeId: randomUUID(),
    createdByUserId: input.createdByUserId,
    collectionId: input.collectionId,
    timestamp
  });

  await withTransaction(async (tx) => {
    await insertOrUpdateRecipe(tx, recipe, timestamp);
    await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [input.collectionId]);
  });
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

  await withTransaction(async (tx) => {
    await insertOrUpdateRecipe(tx, next, timestamp);
    if (existing.collectionId) {
      await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [existing.collectionId]);
    }
    if (next.collectionId && next.collectionId !== existing.collectionId) {
      await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [next.collectionId]);
    }
  });
  return next;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const existing = await getRecipeById(id);
  const result = await query(`DELETE FROM recipes WHERE id = $1`, [id]);
  if ((result.rowCount ?? 0) > 0 && existing?.collectionId) {
    await query(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [existing.collectionId]);
  }
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
  createdByUserId: string | null;
  collectionId: string;
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
    createdByUserId: input.createdByUserId,
    createdAt: timestamp
  });
  const recipe = createImportedRecipeRecord({
    draft: input.draft,
    sourceUrl: input.sourceUrl,
    importPrompt: input.importPrompt?.trim() || null,
    importRunId: importRun.id,
    recipeId: randomUUID(),
    createdByUserId: input.createdByUserId,
    collectionId: input.collectionId,
    createdAt: timestamp
  });

  await withTransaction(async (tx) => {
    await tx(
      `
        INSERT INTO import_runs (
          id,
          owner_id,
          created_by_user_id,
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::timestamptz
        )
      `,
      [
        importRun.id,
        importRun.createdByUserId,
        importRun.createdByUserId,
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
    await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [input.collectionId]);
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
    const existingResult = await tx<RecipeRow>(`SELECT * FROM recipes WHERE id = $1 LIMIT 1 FOR UPDATE`, [
      input.recipeId
    ]);

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
      createdByUserId: existing.createdByUserId,
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
          created_by_user_id,
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::timestamptz
        )
      `,
      [
        importRun.id,
        importRun.createdByUserId,
        importRun.createdByUserId,
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
    if (next.collectionId) {
      await tx(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [next.collectionId]);
    }

    return {
      recipe: next,
      importRun
    };
  });
}
