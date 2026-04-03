import type { components } from "@/generated/openapi";

export type SourceType = components["schemas"]["SourceType"];
export type Unit = components["schemas"]["Unit"];
export type ImportStatus = components["schemas"]["ImportStatus"];

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

export type Recipe = components["schemas"]["Recipe"] & {
  collectionId: string | null;
  createdByUserId: string | null;
};
export type RecipeSummary = Pick<
  Recipe,
  | "id"
  | "title"
  | "heroPhotoUrl"
  | "timeRequiredMinutes"
  | "servingCount"
  | "sourceType"
  | "tags"
  | "updatedAt"
  | "collectionId"
>;

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
  createdByUserId: string | null;
  sourceType: SourceType;
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  status: ImportStatus;
  usable: boolean;
  confidenceOverall: number | null;
  warnings: string[];
  errorMessage: string | null;
  createdAt: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface UserRecord extends UserSummary {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export type CollectionVisibility = "public" | "private";
export type CollectionRole = "OWNER" | "COLLABORATOR" | "VIEWER";

export interface CollectionMemberSummary extends UserSummary {
  role: Exclude<CollectionRole, "OWNER">;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  ownerUserId: string;
  role: CollectionRole;
  recipeCount: number;
  updatedAt: string;
  collaborators: UserSummary[];
  viewers: UserSummary[];
}

export interface CollectionDetail extends CollectionSummary {
  recipes: RecipeSummary[];
}

export interface CollectionCreateInput {
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
}

export interface CollectionUpdateInput extends CollectionCreateInput {}

export interface CollectionDeleteOptions {
  mode: "DELETE_RECIPES" | "REASSIGN";
  targetCollectionId?: string;
}

export interface CollectionAccess {
  collection: {
    id: string;
    ownerUserId: string;
    visibility: CollectionVisibility;
  };
  role: CollectionRole | null;
  canRead: boolean;
  canWriteRecipes: boolean;
  canManageCollection: boolean;
}

export interface StoreData {
  users: UserRecord[];
  collections: Array<{
    id: string;
    name: string;
    description: string | null;
    visibility: CollectionVisibility;
    ownerUserId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  collectionMembers: Array<{
    collectionId: string;
    userId: string;
    role: Exclude<CollectionRole, "OWNER">;
    createdAt: string;
  }>;
  recipes: Recipe[];
  sourceSnapshots: SourceSnapshot[];
  importRuns: ImportRun[];
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
