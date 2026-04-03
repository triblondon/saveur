import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  ImportRun,
  Recipe,
  RecipeCreateInput,
  RecipeSummary,
  SourceSnapshot,
  StoreData,
  UserRecord,
  UserSummary
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const EMPTY_STORE: StoreData = {
  users: [],
  collections: [],
  collectionMembers: [],
  recipes: [],
  sourceSnapshots: [],
  importRuns: []
};

let writeQueue = Promise.resolve();

type MemberRole = Exclude<CollectionRole, "OWNER">;

async function ensureFilesystem(): Promise<void> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeVisibility(value: unknown): "public" | "private" {
  return value === "public" ? "public" : "private";
}

function normalizeMemberRole(value: unknown): MemberRole {
  return value === "VIEWER" ? "VIEWER" : "COLLABORATOR";
}

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ownerId:
      recipe.createdByUserId ??
      ("ownerId" in recipe ? (recipe as { ownerId?: string | null }).ownerId ?? null : null),
    createdByUserId: recipe.createdByUserId ?? ("ownerId" in recipe ? (recipe as { ownerId?: string | null }).ownerId ?? null : null),
    collectionId: recipe.collectionId ?? null,
    sourceType: recipe.sourceType ?? "MANUAL",
    sourceRef: recipe.sourceRef ?? "",
    importPrompt: recipe.importPrompt ?? null,
    importRunId: recipe.importRunId ?? null,
    ingredients: (recipe.ingredients ?? []).map((ingredient) => ({
      ...ingredient,
      unit: ingredient.unit ?? "UNKNOWN"
    })),
    prepTasks: (recipe.prepTasks ?? []).map((task) => ({
      preparationName:
        "preparationName" in task && typeof task.preparationName === "string"
          ? task.preparationName
          : "title" in task && typeof task.title === "string"
            ? task.title
            : "",
      sourceIngredients: "sourceIngredients" in task && Array.isArray(task.sourceIngredients) ? task.sourceIngredients : [],
      detail: task.detail ?? null
    })),
    cookSteps: (recipe.cookSteps ?? []).map((step) => ({
      instruction: step.instruction,
      detail: step.detail ?? null,
      sourceIngredients: "sourceIngredients" in step && Array.isArray(step.sourceIngredients) ? step.sourceIngredients : [],
      timerSeconds: step.timerSeconds ?? null
    }))
  };
}

async function readStore(): Promise<StoreData> {
  await ensureFilesystem();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoreData>;

  return {
    users: (parsed.users ?? []).map((user) => ({
      id: user.id,
      name: user.name?.trim() || "",
      email: normalizeEmail(user.email ?? ""),
      passwordHash: user.passwordHash ?? "",
      createdAt: user.createdAt ?? new Date().toISOString(),
      updatedAt: user.updatedAt ?? new Date().toISOString()
    })),
    collections: (parsed.collections ?? []).map((collection) => ({
      id: collection.id,
      name: collection.name?.trim() || "",
      description: collection.description ?? null,
      visibility: normalizeVisibility(collection.visibility),
      ownerUserId: collection.ownerUserId,
      createdAt: collection.createdAt ?? new Date().toISOString(),
      updatedAt: collection.updatedAt ?? new Date().toISOString()
    })),
    collectionMembers: (parsed.collectionMembers ?? []).map((member) => ({
      collectionId: member.collectionId,
      userId: member.userId,
      role: normalizeMemberRole(member.role),
      createdAt: member.createdAt ?? new Date().toISOString()
    })),
    recipes: (parsed.recipes ?? []).map((recipe) => normalizeRecipe(recipe)),
    sourceSnapshots: parsed.sourceSnapshots ?? [],
    importRuns: (parsed.importRuns ?? []).map((run) => ({
      ...run,
      createdByUserId:
        run.createdByUserId ??
        ("ownerId" in run ? (run as { ownerId?: string | null }).ownerId ?? null : null),
      warnings: Array.isArray(run.warnings)
        ? run.warnings.filter((warning): warning is string => typeof warning === "string")
        : []
    }))
  };
}

function writeStore(data: StoreData): Promise<void> {
  writeQueue = writeQueue.then(() => fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8"));
  return writeQueue;
}

function nowIso(): string {
  return new Date().toISOString();
}

function recipeSearchBlob(recipe: Recipe): string {
  return buildSearchBlob(recipe);
}

export type ManualRecipeInput = RecipeCreateInput;

function toRecipeSummary(recipe: Recipe): RecipeSummary {
  return {
    id: recipe.id,
    title: recipe.title,
    heroPhotoUrl: recipe.heroPhotoUrl,
    timeRequiredMinutes: recipe.timeRequiredMinutes,
    servingCount: recipe.servingCount,
    sourceType: recipe.sourceType,
    tags: recipe.tags,
    updatedAt: recipe.updatedAt,
    collectionId: recipe.collectionId
  };
}

export async function getUserById(id: string): Promise<UserSummary | null> {
  const data = await readStore();
  const user = data.users.find((entry) => entry.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function getUserAuthByEmail(email: string): Promise<UserRecord | null> {
  const data = await readStore();
  const normalized = normalizeEmail(email);
  return data.users.find((entry) => normalizeEmail(entry.email) === normalized) ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserSummary> {
  const data = await readStore();
  const email = normalizeEmail(input.email);
  if (data.users.some((entry) => normalizeEmail(entry.email) === email)) {
    throw new Error("EMAIL_EXISTS");
  }

  const timestamp = nowIso();
  const user: UserRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: input.passwordHash,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  data.users.push(user);
  await writeStore(data);
  return { id: user.id, name: user.name, email: user.email };
}

export async function createCollection(ownerUserId: string, input: CollectionCreateInput) {
  const data = await readStore();
  const timestamp = nowIso();
  const collection = {
    id: randomUUID(),
    ownerUserId,
    name: input.name.trim(),
    description: input.description,
    visibility: input.visibility,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  data.collections.push(collection);
  await writeStore(data);
  return collection;
}

export async function updateCollection(collectionId: string, input: CollectionUpdateInput) {
  const data = await readStore();
  const collection = data.collections.find((entry) => entry.id === collectionId);
  if (!collection) {
    return null;
  }

  collection.name = input.name.trim();
  collection.description = input.description;
  collection.visibility = input.visibility;
  collection.updatedAt = nowIso();
  await writeStore(data);
  return collection;
}

export async function getCollectionById(collectionId: string) {
  const data = await readStore();
  return data.collections.find((entry) => entry.id === collectionId) ?? null;
}

export async function listCollections() {
  const data = await readStore();
  return [...data.collections].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listCollectionMembers(collectionId: string) {
  const data = await readStore();
  return data.collectionMembers.filter((entry) => entry.collectionId === collectionId);
}

export async function upsertCollectionMember(collectionId: string, userId: string, role: MemberRole): Promise<void> {
  const data = await readStore();
  const existing = data.collectionMembers.find(
    (entry) => entry.collectionId === collectionId && entry.userId === userId
  );
  if (existing) {
    existing.role = role;
  } else {
    data.collectionMembers.push({
      collectionId,
      userId,
      role,
      createdAt: nowIso()
    });
  }

  const collection = data.collections.find((entry) => entry.id === collectionId);
  if (collection) {
    collection.updatedAt = nowIso();
  }

  await writeStore(data);
}

export async function removeCollectionMember(collectionId: string, userId: string): Promise<void> {
  const data = await readStore();
  data.collectionMembers = data.collectionMembers.filter(
    (entry) => !(entry.collectionId === collectionId && entry.userId === userId)
  );
  const collection = data.collections.find((entry) => entry.id === collectionId);
  if (collection) {
    collection.updatedAt = nowIso();
  }
  await writeStore(data);
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const data = await readStore();
  data.collections = data.collections.filter((entry) => entry.id !== collectionId);
  data.collectionMembers = data.collectionMembers.filter((entry) => entry.collectionId !== collectionId);
  await writeStore(data);
}

export async function moveRecipesBetweenCollections(
  sourceCollectionId: string,
  targetCollectionId: string
): Promise<void> {
  const data = await readStore();
  const timestamp = nowIso();
  for (const recipe of data.recipes) {
    if (recipe.collectionId === sourceCollectionId) {
      recipe.collectionId = targetCollectionId;
      recipe.updatedAt = timestamp;
    }
  }

  const source = data.collections.find((entry) => entry.id === sourceCollectionId);
  const target = data.collections.find((entry) => entry.id === targetCollectionId);
  if (source) {
    source.updatedAt = timestamp;
  }
  if (target) {
    target.updatedAt = timestamp;
  }
  await writeStore(data);
}

export async function deleteRecipesByCollection(collectionId: string): Promise<void> {
  const data = await readStore();
  data.recipes = data.recipes.filter((entry) => entry.collectionId !== collectionId);
  const collection = data.collections.find((entry) => entry.id === collectionId);
  if (collection) {
    collection.updatedAt = nowIso();
  }
  await writeStore(data);
}

export async function listRecipeSummaries(query?: string): Promise<RecipeSummary[]> {
  const recipes = await listRecipes(query);
  return recipes.map(toRecipeSummary);
}

export async function listRecipes(query?: string): Promise<Recipe[]> {
  const data = await readStore();

  const sorted = [...data.recipes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!query) {
    return sorted;
  }

  const needle = query.toLowerCase().trim();
  return sorted.filter((recipe) => recipeSearchBlob(recipe).includes(needle));
}

export async function listRecipesByCollection(collectionId: string): Promise<Recipe[]> {
  const recipes = await listRecipes();
  return recipes.filter((recipe) => recipe.collectionId === collectionId);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const data = await readStore();
  return data.recipes.find((recipe) => recipe.id === id) ?? null;
}

export async function getImportRunById(id: string): Promise<ImportRun | null> {
  const data = await readStore();
  return data.importRuns.find((run) => run.id === id) ?? null;
}

export async function createManualRecipe(input: ManualRecipeInput & {
  createdByUserId: string | null;
  collectionId: string;
}): Promise<Recipe> {
  const data = await readStore();
  const timestamp = nowIso();
  const recipe = createManualRecipeRecord({
    input,
    recipeId: randomUUID(),
    createdByUserId: input.createdByUserId,
    collectionId: input.collectionId,
    timestamp
  });

  data.recipes.push(recipe);
  const collection = data.collections.find((entry) => entry.id === input.collectionId);
  if (collection) {
    collection.updatedAt = timestamp;
  }
  await writeStore(data);

  return recipe;
}

export async function updateRecipe(
  id: string,
  updates: Partial<Omit<Recipe, "id" | "createdAt">>
): Promise<Recipe | null> {
  const data = await readStore();
  const recipe = data.recipes.find((entry) => entry.id === id);
  if (!recipe) {
    return null;
  }

  const next: Recipe = {
    ...recipe,
    ...updates,
    id: recipe.id,
    createdAt: recipe.createdAt,
    updatedAt: nowIso()
  };

  const index = data.recipes.findIndex((entry) => entry.id === id);
  data.recipes[index] = next;
  if (recipe.collectionId) {
    const collection = data.collections.find((entry) => entry.id === recipe.collectionId);
    if (collection) {
      collection.updatedAt = next.updatedAt;
    }
  }
  if (next.collectionId && next.collectionId !== recipe.collectionId) {
    const collection = data.collections.find((entry) => entry.id === next.collectionId);
    if (collection) {
      collection.updatedAt = next.updatedAt;
    }
  }
  await writeStore(data);

  return next;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const data = await readStore();
  const index = data.recipes.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return false;
  }

  const recipe = data.recipes[index];
  data.recipes.splice(index, 1);
  if (recipe.collectionId) {
    const collection = data.collections.find((entry) => entry.id === recipe.collectionId);
    if (collection) {
      collection.updatedAt = nowIso();
    }
  }
  await writeStore(data);

  return true;
}

export async function saveSourceSnapshot(sourceUrl: string, html: string): Promise<SourceSnapshot> {
  const data = await readStore();

  const snapshotId = randomUUID();
  const storageKey = `${snapshotId}.html`;
  const absolutePath = path.join(SNAPSHOT_DIR, storageKey);

  await fs.writeFile(absolutePath, html, "utf8");

  const snapshot: SourceSnapshot = {
    id: snapshotId,
    sourceUrl,
    storageKey,
    contentType: "text/html",
    fetchedAt: nowIso(),
    fetchStatus: "OK"
  };

  data.sourceSnapshots.push(snapshot);
  await writeStore(data);

  return snapshot;
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
  const data = await readStore();
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

  data.importRuns.push(importRun);
  data.recipes.push(recipe);
  const collection = data.collections.find((entry) => entry.id === input.collectionId);
  if (collection) {
    collection.updatedAt = timestamp;
  }
  await writeStore(data);

  return {
    recipe,
    importRun
  };
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
  const data = await readStore();
  const timestamp = nowIso();

  const existing = data.recipes.find((entry) => entry.id === input.recipeId);
  if (!existing) {
    return null;
  }

  const importRun = createImportRunRecord({
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    draft: input.draft,
    id: randomUUID(),
    createdByUserId: existing.createdByUserId ?? null,
    createdAt: timestamp
  });

  const next = updateRecipeFromDraft(existing, {
    draft: input.draft,
    sourceUrl: input.sourceUrl,
    importPrompt: input.importPrompt?.trim() || null,
    importRunId: importRun.id,
    updatedAt: timestamp
  });

  const recipeIndex = data.recipes.findIndex((entry) => entry.id === input.recipeId);
  data.recipes[recipeIndex] = next;
  data.importRuns.push(importRun);
  if (next.collectionId) {
    const collection = data.collections.find((entry) => entry.id === next.collectionId);
    if (collection) {
      collection.updatedAt = timestamp;
    }
  }
  await writeStore(data);

  return {
    recipe: next,
    importRun
  };
}
