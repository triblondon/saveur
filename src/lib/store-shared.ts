import {
  buildImportStatus,
  normalizeCookStepData,
  normalizeIngredientData,
  normalizeParsedRecipeDraft,
  normalizePrepTaskData,
  normalizeRecipeCreateInput,
  normalizeTags
} from "@/lib/recipe-domain";
import type { ParsedRecipeDraft } from "@/lib/import/types";
import type { ImportRun, Recipe, RecipeCreateInput } from "@/lib/types";

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}

export function buildSearchBlob(recipe: {
  title: string;
  ingredients: Array<{ name: string }>;
  tags: string[];
}): string {
  const ingredients = recipe.ingredients.map((item) => item.name).join(" ");
  const tags = recipe.tags.join(" ");
  return normalizeSearch(`${recipe.title} ${ingredients} ${tags}`);
}

export function createManualRecipeRecord(params: {
  input: RecipeCreateInput;
  recipeId: string;
  createdByUserId: string | null;
  collectionId: string;
  timestamp: string;
}): Recipe {
  const normalizedInput = normalizeRecipeCreateInput(params.input);

  return {
    id: params.recipeId,
    ownerId: params.createdByUserId,
    createdByUserId: params.createdByUserId,
    collectionId: params.collectionId,
    title: normalizedInput.title,
    sourceType: normalizedInput.sourceType,
    sourceRef: normalizedInput.sourceRef,
    importPrompt: normalizedInput.importPrompt,
    description: normalizedInput.description,
    tags: normalizeTags(normalizedInput.tags),
    timeRequiredMinutes: normalizedInput.timeRequiredMinutes,
    servingCount: normalizedInput.servingCount,
    heroPhotoUrl: normalizedInput.heroPhotoUrl,
    importRunId: null,
    ingredients: normalizedInput.ingredients.map(normalizeIngredientData),
    prepTasks: normalizedInput.prepTasks.map(normalizePrepTaskData),
    cookSteps: normalizedInput.cookSteps.map(normalizeCookStepData),
    createdAt: params.timestamp,
    updatedAt: params.timestamp
  };
}

export function createImportRunRecord(params: {
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  id: string;
  createdByUserId: string | null;
  createdAt: string;
}): ImportRun {
  const draft = normalizeParsedRecipeDraft(params.draft);
  const status = buildImportStatus(draft);

  return {
    id: params.id,
    createdByUserId: params.createdByUserId,
    sourceType: "URL",
    sourceUrl: params.sourceUrl,
    adapterName: params.adapterName,
    adapterVersion: params.adapterVersion,
    snapshotId: params.snapshotId,
    status: status.status,
    usable: status.usable,
    confidenceOverall: draft.confidence.overall,
    warnings: draft.warnings,
    errorMessage: status.errorMessage,
    createdAt: params.createdAt
  };
}

export function createImportedRecipeRecord(params: {
  draft: ParsedRecipeDraft;
  sourceUrl: string;
  importPrompt: string | null;
  importRunId: string;
  recipeId: string;
  createdByUserId: string | null;
  collectionId: string;
  createdAt: string;
}): Recipe {
  const draft = normalizeParsedRecipeDraft(params.draft);

  return {
    id: params.recipeId,
    ownerId: params.createdByUserId,
    createdByUserId: params.createdByUserId,
    collectionId: params.collectionId,
    title: draft.title,
    sourceType: "URL",
    sourceRef: params.sourceUrl,
    importPrompt: params.importPrompt,
    description: draft.description,
    tags: normalizeTags(draft.tags),
    timeRequiredMinutes: draft.timeRequiredMinutes,
    servingCount: draft.servingCount,
    heroPhotoUrl: draft.heroPhotoUrl,
    importRunId: params.importRunId,
    ingredients: draft.ingredients.map(normalizeIngredientData),
    prepTasks: draft.prepTasks.map(normalizePrepTaskData),
    cookSteps: draft.cookSteps.map(normalizeCookStepData),
    createdAt: params.createdAt,
    updatedAt: params.createdAt
  };
}

export function updateRecipeFromDraft(
  existing: Recipe,
  params: {
    draft: ParsedRecipeDraft;
    sourceUrl: string;
    importPrompt: string | null;
    importRunId: string;
    updatedAt: string;
  }
): Recipe {
  const draft = normalizeParsedRecipeDraft(params.draft);

  return {
    ...existing,
    title: draft.title,
    sourceType: "URL",
    sourceRef: params.sourceUrl,
    importPrompt: params.importPrompt,
    description: draft.description,
    tags: normalizeTags(draft.tags),
    timeRequiredMinutes: draft.timeRequiredMinutes,
    servingCount: draft.servingCount,
    heroPhotoUrl: draft.heroPhotoUrl,
    importRunId: params.importRunId,
    ingredients: draft.ingredients.map(normalizeIngredientData),
    prepTasks: draft.prepTasks.map(normalizePrepTaskData),
    cookSteps: draft.cookSteps.map(normalizeCookStepData),
    updatedAt: params.updatedAt
  };
}
