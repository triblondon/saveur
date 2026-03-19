import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildSearchBlob,
  collectImportFeedback,
  createImportedRecipeRecord,
  createImportRunRecord,
  createManualRecipeRecord,
  updateRecipeFromDraft
} from "@/lib/store-shared";
import type {
  ImportFeedback,
  ImportRun,
  Recipe,
  RecipeCreateInput,
  RecipeSummary,
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
        sourceIngredients:
          "sourceIngredients" in task && Array.isArray(task.sourceIngredients)
            ? task.sourceIngredients
            : [],
        detail: task.detail ?? null
      })),
      cookSteps: (recipe.cookSteps ?? []).map((step) => ({
        instruction: step.instruction,
        detail: step.detail ?? null,
        sourceIngredients:
          "sourceIngredients" in step && Array.isArray(step.sourceIngredients)
            ? step.sourceIngredients
            : [],
        timerSeconds: step.timerSeconds ?? null
      }))
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
    updatedAt: recipe.updatedAt
  };
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

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const data = await readStore();
  return data.recipes.find((recipe) => recipe.id === id) ?? null;
}

export async function createManualRecipe(input: ManualRecipeInput): Promise<Recipe> {
  const data = await readStore();
  const timestamp = nowIso();
  const recipe = createManualRecipeRecord({
    input,
    recipeId: randomUUID(),
    ownerId: null,
    timestamp
  });

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

  const importRun = createImportRunRecord({
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    draft: input.draft,
    id: randomUUID(),
    ownerId: existing.ownerId ?? null,
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
  await writeStore(data);

  return {
    recipe: next,
    importRun
  };
}

export async function captureImportFeedback(
  recipeBefore: Recipe,
  recipeAfter: Recipe
): Promise<ImportFeedback[]> {
  const data = await readStore();
  const feedbackRows = collectImportFeedback(recipeBefore, recipeAfter, randomUUID, nowIso);

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
