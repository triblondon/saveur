import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CookStep,
  CookStepDraftData,
  IngredientData,
  ImportFeedback,
  ImportRun,
  ImportStatus,
  Ingredient,
  PrepTaskData,
  PrepTask,
  Recipe,
  RecipeCreateInput,
  SourceSnapshot,
  StoreData
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const EMPTY_STORE: StoreData = {
  recipes: [],
  sourceSnapshots: [],
  importRuns: [],
  importFeedback: []
};

let writeQueue = Promise.resolve();

async function ensureFilesystem(): Promise<void> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreData> {
  await ensureFilesystem();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoreData>;

  return {
    recipes: (parsed.recipes ?? []).map((recipe) => ({
      ...recipe,
      importPrompt: recipe.importPrompt ?? null
    })),
    sourceSnapshots: parsed.sourceSnapshots ?? [],
    importRuns: parsed.importRuns ?? [],
    importFeedback: parsed.importFeedback ?? []
  };
}

function writeStore(data: StoreData): Promise<void> {
  writeQueue = writeQueue.then(() => fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8"));
  return writeQueue;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}

function recipeSearchBlob(recipe: Recipe): string {
  const ingredients = recipe.ingredients.map((ingredient) => ingredient.name).join(" ");
  const tags = recipe.tags.join(" ");
  return normalizeSearch(`${recipe.title} ${ingredients} ${tags}`);
}

function mapIngredients(input: IngredientData[]): Ingredient[] {
  return input.map((item, index) => ({
    id: randomUUID(),
    position: index,
    name: item.name,
    quantityText: item.quantityText,
    quantityValue: item.quantityValue,
    quantityMin: item.quantityMin,
    quantityMax: item.quantityMax,
    unit: item.unit,
    isWholeItem: item.isWholeItem,
    optional: item.optional,
    isPantryItem: item.isPantryItem
  }));
}

function mapPrepTasks(input: PrepTaskData[]): PrepTask[] {
  return input.map((item, index) => ({
    id: randomUUID(),
    position: index,
    title: item.title,
    detail: item.detail
  }));
}

function mapCookSteps(input: CookStepDraftData[], prepTasks: PrepTask[]): CookStep[] {
  return input.map((item, index) => ({
    id: randomUUID(),
    position: index,
    instruction: item.instruction,
    detail: item.detail,
    timerSeconds: item.timerSeconds,
    prepTaskRefs: item.prepTaskRefs
      .map((prepTaskIndex) => prepTasks[prepTaskIndex]?.id)
      .filter((value): value is string => Boolean(value))
  }));
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const clean = tag.trim();
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(clean);
  }

  return normalized;
}

export type ManualRecipeInput = RecipeCreateInput;

export async function listRecipes(query?: string): Promise<Recipe[]> {
  const data = await readStore();

  const sorted = [...data.recipes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!query) {
    return sorted;
  }

  const needle = normalizeSearch(query);
  return sorted.filter((recipe) => recipeSearchBlob(recipe).includes(needle));
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const data = await readStore();
  return data.recipes.find((recipe) => recipe.id === id) ?? null;
}

export async function createManualRecipe(input: ManualRecipeInput): Promise<Recipe> {
  const data = await readStore();
  const timestamp = nowIso();

  const ingredients: Ingredient[] = input.ingredients.map((item, index) => ({
    id: randomUUID(),
    position: index,
    name: item.name,
    quantityText: item.quantityText ?? null,
    quantityValue: item.quantityValue ?? null,
    quantityMin: item.quantityMin ?? null,
    quantityMax: item.quantityMax ?? null,
    unit: item.unit ?? null,
    isWholeItem: item.isWholeItem ?? false,
    optional: item.optional ?? false,
    isPantryItem: item.isPantryItem ?? false
  }));

  const prepTaskIdByLocalId = new Map<string, string>();
  const prepTasks: PrepTask[] = input.prepTasks.map((item, index) => {
    const id = randomUUID();
    const localId = item.localId?.trim();
    if (localId) {
      prepTaskIdByLocalId.set(localId, id);
    }

    return {
      id,
      position: index,
      title: item.title,
      detail: item.detail ?? null
    };
  });

  const cookSteps: CookStep[] = input.cookSteps.map((item, index) => ({
    id: randomUUID(),
    position: index,
    instruction: item.instruction,
    detail: item.detail ?? null,
    timerSeconds: item.timerSeconds ?? null,
    prepTaskRefs: (item.prepTaskRefs ?? []).map((ref) => prepTaskIdByLocalId.get(ref) ?? ref)
  }));

  const recipe: Recipe = {
    id: randomUUID(),
    ownerId: null,
    title: input.title.trim(),
    sourceType: input.sourceType ?? "MANUAL",
    sourceRef: input.sourceRef?.trim() || "",
    importPrompt: input.importPrompt?.trim() || null,
    description: input.description ?? null,
    tags: normalizeTags(input.tags ?? []),
    timeRequiredMinutes: input.timeRequiredMinutes ?? null,
    servingCount: input.servingCount ?? null,
    heroPhotoUrl: input.heroPhotoUrl ?? null,
    importRunId: null,
    ingredients,
    prepTasks,
    cookSteps,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  data.recipes.push(recipe);
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
  await writeStore(data);

  return next;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const data = await readStore();
  const index = data.recipes.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return false;
  }

  data.recipes.splice(index, 1);
  data.importFeedback = data.importFeedback.filter((feedback) => feedback.recipeId !== id);
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
}

export async function createImportedRecipe(input: CreateImportedRecipeInput): Promise<{
  recipe: Recipe;
  importRun: ImportRun;
}> {
  const data = await readStore();
  const timestamp = nowIso();

  const usable =
    input.draft.title.trim().length > 0 &&
    input.draft.ingredients.length > 0 &&
    input.draft.cookSteps.length > 0;

  const status: ImportStatus = usable
    ? input.draft.warnings.length > 0
      ? "PARTIAL"
      : "SUCCESS"
    : "FAILED";

  const importRun: ImportRun = {
    id: randomUUID(),
    ownerId: null,
    sourceType: "URL",
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    status,
    usable,
    confidenceOverall: input.draft.confidence.overall,
    errorMessage: usable ? null : "Recipe draft missing title, ingredients, or cook steps",
    createdAt: timestamp
  };

  const recipe: Recipe = {
    id: randomUUID(),
    ownerId: null,
    title: input.draft.title,
    sourceType: "URL",
    sourceRef: input.sourceUrl,
    importPrompt: input.importPrompt?.trim() || null,
    description: input.draft.description,
    tags: normalizeTags(input.draft.tags),
    timeRequiredMinutes: input.draft.timeRequiredMinutes,
    servingCount: input.draft.servingCount,
    heroPhotoUrl: input.draft.heroPhotoUrl,
    importRunId: importRun.id,
    ingredients: mapIngredients(input.draft.ingredients),
    prepTasks: mapPrepTasks(input.draft.prepTasks),
    cookSteps: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  recipe.cookSteps = mapCookSteps(input.draft.cookSteps, recipe.prepTasks);

  data.importRuns.push(importRun);
  data.recipes.push(recipe);
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

  const usable =
    input.draft.title.trim().length > 0 &&
    input.draft.ingredients.length > 0 &&
    input.draft.cookSteps.length > 0;

  const status: ImportStatus = usable
    ? input.draft.warnings.length > 0
      ? "PARTIAL"
      : "SUCCESS"
    : "FAILED";

  const importRun: ImportRun = {
    id: randomUUID(),
    ownerId: existing.ownerId ?? null,
    sourceType: "URL",
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    status,
    usable,
    confidenceOverall: input.draft.confidence.overall,
    errorMessage: usable ? null : "Recipe draft missing title, ingredients, or cook steps",
    createdAt: timestamp
  };

  const ingredients = mapIngredients(input.draft.ingredients);
  const prepTasks = mapPrepTasks(input.draft.prepTasks);
  const cookSteps = mapCookSteps(input.draft.cookSteps, prepTasks);

  const next: Recipe = {
    ...existing,
    title: input.draft.title,
    sourceType: "URL",
    sourceRef: input.sourceUrl,
    importPrompt: input.importPrompt?.trim() || null,
    description: input.draft.description,
    tags: normalizeTags(input.draft.tags),
    timeRequiredMinutes: input.draft.timeRequiredMinutes,
    servingCount: input.draft.servingCount,
    heroPhotoUrl: input.draft.heroPhotoUrl,
    importRunId: importRun.id,
    ingredients,
    prepTasks,
    cookSteps,
    updatedAt: timestamp
  };

  const recipeIndex = data.recipes.findIndex((entry) => entry.id === input.recipeId);
  data.recipes[recipeIndex] = next;
  data.importRuns.push(importRun);
  await writeStore(data);

  return {
    recipe: next,
    importRun
  };
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function captureImportFeedback(
  recipeBefore: Recipe,
  recipeAfter: Recipe
): Promise<ImportFeedback[]> {
  if (!recipeBefore.importRunId || recipeBefore.importRunId !== recipeAfter.importRunId) {
    return [];
  }

  const data = await readStore();
  const feedbackRows: ImportFeedback[] = [];
  const fieldPaths: Array<keyof Recipe> = [
    "title",
    "description",
    "timeRequiredMinutes",
    "servingCount",
    "ingredients",
    "prepTasks",
    "cookSteps",
    "tags"
  ];

  for (const fieldPath of fieldPaths) {
    const beforeValue = recipeBefore[fieldPath];
    const afterValue = recipeAfter[fieldPath];

    if (jsonEqual(beforeValue, afterValue)) {
      continue;
    }

    feedbackRows.push({
      id: randomUUID(),
      importRunId: recipeBefore.importRunId,
      recipeId: recipeBefore.id,
      fieldPath,
      originalValue: beforeValue,
      finalValue: afterValue,
      feedbackType: "EDIT",
      createdAt: nowIso()
    });
  }

  data.importFeedback.push(...feedbackRows);
  await writeStore(data);

  return feedbackRows;
}

export async function listImportFeedback(importRunId: string): Promise<ImportFeedback[]> {
  const data = await readStore();
  return data.importFeedback
    .filter((item) => item.importRunId === importRunId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
