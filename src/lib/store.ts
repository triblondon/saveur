import { isDatabaseConfigured } from "@/lib/db";
import * as fileStore from "@/lib/store-file";
import * as postgresStore from "@/lib/store-postgres";
import type {
  ImportFeedback,
  ImportRun,
  Recipe,
  SourceSnapshot
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

interface StoreBackend {
  listRecipes: (query?: string) => Promise<Recipe[]>;
  getRecipeById: (id: string) => Promise<Recipe | null>;
  createManualRecipe: (input: ManualRecipeInput) => Promise<Recipe>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, "id" | "createdAt">>) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<boolean>;
  saveSourceSnapshot: (sourceUrl: string, html: string) => Promise<SourceSnapshot>;
  createImportedRecipe: (input: {
    sourceUrl: string;
    adapterName: string;
    adapterVersion: string;
    snapshotId: string | null;
    draft: ParsedRecipeDraft;
    importPrompt?: string | null;
  }) => Promise<{ recipe: Recipe; importRun: ImportRun }>;
  reimportRecipe: (input: {
    recipeId: string;
    sourceUrl: string;
    adapterName: string;
    adapterVersion: string;
    snapshotId: string | null;
    draft: ParsedRecipeDraft;
    importPrompt?: string | null;
  }) => Promise<{ recipe: Recipe; importRun: ImportRun } | null>;
  captureImportFeedback: (recipeBefore: Recipe, recipeAfter: Recipe) => Promise<ImportFeedback[]>;
  listImportFeedback: (importRunId: string) => Promise<ImportFeedback[]>;
}

export type ManualRecipeInput = fileStore.ManualRecipeInput;

const backend: StoreBackend = isDatabaseConfigured() ? postgresStore : fileStore;

export async function listRecipes(query?: string): Promise<Recipe[]> {
  return backend.listRecipes(query);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  return backend.getRecipeById(id);
}

export async function createManualRecipe(input: ManualRecipeInput): Promise<Recipe> {
  return backend.createManualRecipe(input);
}

export async function updateRecipe(
  id: string,
  updates: Partial<Omit<Recipe, "id" | "createdAt">>
): Promise<Recipe | null> {
  return backend.updateRecipe(id, updates);
}

export async function deleteRecipe(id: string): Promise<boolean> {
  return backend.deleteRecipe(id);
}

export async function saveSourceSnapshot(sourceUrl: string, html: string): Promise<SourceSnapshot> {
  return backend.saveSourceSnapshot(sourceUrl, html);
}

export async function createImportedRecipe(input: {
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  importPrompt?: string | null;
}): Promise<{ recipe: Recipe; importRun: ImportRun }> {
  return backend.createImportedRecipe(input);
}

export async function reimportRecipe(input: {
  recipeId: string;
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  importPrompt?: string | null;
}): Promise<{ recipe: Recipe; importRun: ImportRun } | null> {
  return backend.reimportRecipe(input);
}

export async function captureImportFeedback(recipeBefore: Recipe, recipeAfter: Recipe): Promise<ImportFeedback[]> {
  return backend.captureImportFeedback(recipeBefore, recipeAfter);
}

export async function listImportFeedback(importRunId: string): Promise<ImportFeedback[]> {
  return backend.listImportFeedback(importRunId);
}
