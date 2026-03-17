import type { components } from "@/generated/openapi";

export type SourceType = components["schemas"]["SourceType"];
export type Unit = components["schemas"]["Unit"];
export type ImportStatus = components["schemas"]["ImportStatus"];
export type FeedbackType = components["schemas"]["FeedbackType"];

export type IngredientData = components["schemas"]["IngredientData"];
export type IngredientInput = components["schemas"]["IngredientInput"];
export type Ingredient = components["schemas"]["Ingredient"];

export type PrepTaskData = components["schemas"]["PrepTaskData"];
export type PrepTaskInput = components["schemas"]["PrepTaskInput"];
export type PrepTask = components["schemas"]["PrepTask"];

export type CookStepData = components["schemas"]["CookStepData"];
export type CookStepDraftData = components["schemas"]["CookStepDraftData"];
export type CookStepInput = components["schemas"]["CookStepInput"];
export type CookStep = components["schemas"]["CookStep"];

export type ImportConfidence = components["schemas"]["ImportConfidence"];
export type ImportDraft = components["schemas"]["ImportDraft"];

export type RecipeCreateInput = components["schemas"]["RecipeCreateInput"];
export type RecipeUpdateInput = components["schemas"]["RecipeUpdateInput"];
export type Recipe = components["schemas"]["Recipe"];

export type SourceSnapshot = components["schemas"]["SourceSnapshot"];
export type ImportRun = components["schemas"]["ImportRun"];
export type ImportFeedback = components["schemas"]["ImportFeedback"];
export type StoreData = components["schemas"]["StoreData"];

export type ImportUrlRequest = components["schemas"]["ImportUrlRequest"];
export type ReimportRecipeRequest = components["schemas"]["ReimportRecipeRequest"];

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
