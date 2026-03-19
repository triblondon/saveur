import type {
  CookStepData,
  ImportStatus,
  IngredientData,
  PrepTaskData,
  RecipeCreateInput,
  RecipeUpdateInput
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSingleLine(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const clean = normalizeSingleLine(tag);
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(clean);
  }

  return normalized;
}

export function normalizeIngredientData(input: IngredientData): IngredientData {
  return {
    name: normalizeSingleLine(input.name),
    quantityText: trimOrNull(input.quantityText),
    quantityValue: Number.isFinite(input.quantityValue) ? input.quantityValue : null,
    quantityMin: Number.isFinite(input.quantityMin) ? input.quantityMin : null,
    quantityMax: Number.isFinite(input.quantityMax) ? input.quantityMax : null,
    unit: input.unit ?? "UNKNOWN",
    isWholeItem: Boolean(input.isWholeItem),
    optional: Boolean(input.optional),
    isPantryItem: Boolean(input.isPantryItem)
  };
}

export function normalizePrepTaskData(input: PrepTaskData): PrepTaskData {
  return {
    preparationName: normalizeSingleLine(input.preparationName),
    sourceIngredients: normalizeStringList(input.sourceIngredients),
    detail: trimOrNull(input.detail)
  };
}

export function normalizeCookStepData(input: CookStepData): CookStepData {
  const timerSeconds =
    typeof input.timerSeconds === "number" && Number.isFinite(input.timerSeconds)
      ? Math.max(0, Math.round(input.timerSeconds))
      : null;

  return {
    instruction: normalizeSingleLine(input.instruction),
    detail: trimOrNull(input.detail),
    sourceIngredients: normalizeStringList(input.sourceIngredients ?? []),
    timerSeconds
  };
}

function normalizeRecipePayload<T extends RecipeCreateInput | RecipeUpdateInput>(payload: T): T {
  return {
    ...payload,
    title: normalizeSingleLine(payload.title),
    description: trimOrNull(payload.description),
    heroPhotoUrl: trimOrNull(payload.heroPhotoUrl),
    sourceRef: normalizeSingleLine(payload.sourceRef),
    importPrompt: trimOrNull(payload.importPrompt),
    tags: normalizeTags(payload.tags),
    ingredients: payload.ingredients.map(normalizeIngredientData),
    prepTasks: payload.prepTasks.map(normalizePrepTaskData),
    cookSteps: payload.cookSteps.map(normalizeCookStepData)
  };
}

export function normalizeRecipeCreateInput(payload: RecipeCreateInput): RecipeCreateInput {
  return normalizeRecipePayload(payload);
}

export function normalizeRecipeUpdateInput(payload: RecipeUpdateInput): RecipeUpdateInput {
  return normalizeRecipePayload(payload);
}

export function normalizeParsedRecipeDraft(output: ParsedRecipeDraft): ParsedRecipeDraft {
  return {
    ...output,
    title: normalizeSingleLine(output.title),
    description: trimOrNull(output.description),
    heroPhotoUrl: trimOrNull(output.heroPhotoUrl),
    tags: normalizeTags(output.tags),
    ingredients: output.ingredients.map(normalizeIngredientData),
    prepTasks: output.prepTasks.map(normalizePrepTaskData),
    cookSteps: output.cookSteps.map(normalizeCookStepData),
    warnings: normalizeStringList(output.warnings)
  };
}

export function buildImportStatus(draft: ParsedRecipeDraft): {
  usable: boolean;
  status: ImportStatus;
  errorMessage: string | null;
} {
  const usable = draft.title.length > 0 && draft.ingredients.length > 0 && draft.cookSteps.length > 0;
  const status: ImportStatus = usable ? (draft.warnings.length > 0 ? "PARTIAL" : "SUCCESS") : "FAILED";

  return {
    usable,
    status,
    errorMessage: usable ? null : "Recipe draft missing title, ingredients, or cook steps"
  };
}
