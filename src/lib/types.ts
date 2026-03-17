import type { components } from "@/generated/openapi";

export type SourceType = components["schemas"]["SourceType"];
export type Unit = components["schemas"]["Unit"];
export type ImportStatus = components["schemas"]["ImportStatus"];
export type FeedbackType = components["schemas"]["FeedbackType"];

export type IngredientData = components["schemas"]["IngredientData"];
export type Ingredient = IngredientData;
export type IngredientInput = IngredientData;

export type PrepTaskData = components["schemas"]["PrepTaskData"];
export type PrepTask = PrepTaskData;
export type PrepTaskInput = PrepTaskData;

export type CookStepData = components["schemas"]["CookStepData"];
export type CookStep = CookStepData;
export type CookStepInput = CookStepData;
export type CookStepDraftData = CookStepData;

export type ImportConfidence = components["schemas"]["ImportConfidence"];
export type RecipeMetaData = components["schemas"]["RecipeMetaData"];
export type BaseRecipe = components["schemas"]["BaseRecipe"];
export type RecipeFromLlmImport = components["schemas"]["RecipeFromLlmImport"];

export type Recipe = components["schemas"]["Recipe"];

export type ImportFeedback = components["schemas"]["ImportFeedback"];
export type ImportUrlRequest = components["schemas"]["ImportUrlRequest"];
export type ReimportRecipeRequest = components["schemas"]["ReimportRecipeRequest"];

export type RecipeCreateInput = BaseRecipe;
export type RecipeUpdateInput = BaseRecipe;
export type ImportDraft = RecipeFromLlmImport;

export interface SourceSnapshot {
  id: string;
  sourceUrl: string;
  storageKey: string;
  contentType: string;
  fetchedAt: string;
  fetchStatus: "OK" | "FAILED";
}

export interface ImportRun {
  id: string;
  ownerId: string | null;
  sourceType: SourceType;
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  status: ImportStatus;
  usable: boolean;
  confidenceOverall: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface StoreData {
  recipes: Recipe[];
  sourceSnapshots: SourceSnapshot[];
  importRuns: ImportRun[];
  importFeedback: ImportFeedback[];
}

export const SOURCE_TYPE_OPTIONS = ["MANUAL", "URL", "SCAN"] as const satisfies readonly SourceType[];
export const UNIT_OPTIONS = [
  "UNIT",
  "ML",
  "GRAM",
  "KG",
  "TSP",
  "TBSP",
  "PINCH",
  "HANDFUL",
  "UNKNOWN"
] as const satisfies readonly Unit[];
